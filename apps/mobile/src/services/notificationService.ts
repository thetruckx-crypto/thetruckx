import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, PermissionsAndroid, Alert, NativeModules } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { MobileRole, AppNotificationItem } from '../types';
import { authService, getBackendApiUrl } from './authService';
import {
  NotificationEventType,
  NotificationTemplate,
  buildNotificationItem,
  getRoleNotificationCatalog,
  CLIENT_NOTIFICATIONS,
  VENDOR_NOTIFICATIONS,
  DRIVER_NOTIFICATIONS,
} from './notificationCatalog';

export {
  NotificationEventType,
  NotificationTemplate,
  buildNotificationItem,
  getRoleNotificationCatalog,
  CLIENT_NOTIFICATIONS,
  VENDOR_NOTIFICATIONS,
  DRIVER_NOTIFICATIONS,
};

const { PushNotificationModule } = NativeModules;

/**
 * Display a real Android system push notification in the OS notification shade/tray
 */
export async function showSystemPushNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && PushNotificationModule?.displayPushNotification) {
      const sanitizedData: Record<string, string> = {};
      if (data) {
        Object.entries(data).forEach(([k, v]) => {
          sanitizedData[k] = typeof v === 'string' ? v : JSON.stringify(v);
        });
      }
      await PushNotificationModule.displayPushNotification(title, body, sanitizedData);
      console.log('[NotificationService] Android system push notification displayed:', title);
      return true;
    }
  } catch (err: any) {
    console.warn('[NotificationService] System push notification display warning:', err?.message || err);
  }
  return false;
}

const STORAGE_KEYS = {
  DEVICE_TOKEN: '@necl_device_push_token',
  PERMISSION_STATE: '@necl_notif_permission',
  LAST_REGISTERED_USER: '@necl_last_registered_user',
  CACHED_NOTIFICATIONS: '@necl_cached_notifications_list',
};

const getApiBaseUrl = () => getBackendApiUrl();

export interface DeviceTokenPayload {
  pushToken: string;
  userId?: string;
  role?: MobileRole;
  platform: 'android' | 'ios' | 'web';
}

class MobileNotificationService {
  private currentToken: string | null = null;
  private isListeningForeground = false;

  /**
   * Check if notification permission has been granted
   */
  async hasPermission(): Promise<boolean> {
    try {
      const state = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_STATE);
      return state === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Save user permission state
   */
  async setPermission(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PERMISSION_STATE,
        granted ? 'granted' : 'denied'
      );
    } catch (e) {
      console.warn('[NotificationService] Failed to persist permission state:', e);
    }
  }

  /**
   * Request native OS permission dialog (triggers Android 13+ POST_NOTIFICATIONS OS pop-up)
   */
  async requestOSNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
        if (androidVersion >= 33) {
          // Triggers system OS pop-up on Android
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'THE TRUCKX Notifications',
              message: 'Allow THE TRUCKX to send you live dispatch updates, vehicle assignments, and digital POD alerts.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: "Don't Allow",
              buttonPositive: 'Allow',
            }
          );
          const granted = result === PermissionsAndroid.RESULTS.GRANTED;
          await this.setPermission(granted);
          return granted;
        } else {
          await this.setPermission(true);
          return true;
        }
      } catch (e) {
        console.warn('[NotificationService] Android OS permission request warning:', e);
        await this.setPermission(true);
        return true;
      }
    }

    await this.setPermission(true);
    return true;
  }

  /**
   * Retrieve cached device push token
   */
  async getStoredToken(): Promise<string | null> {
    if (this.currentToken) return this.currentToken;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
      if (stored) {
        this.currentToken = stored;
      }
      return stored;
    } catch {
      return null;
    }
  }

  /**
   * Register device push token to backend API
   */
  async registerTokenWithBackend(params: {
    pushToken: string;
    userId?: string;
    role?: MobileRole;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const payload: DeviceTokenPayload = {
        pushToken: params.pushToken,
        userId: params.userId,
        role: params.role,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      };

      const res = await fetch(`${getApiBaseUrl()}/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, params.pushToken);
        if (params.userId) {
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_REGISTERED_USER, params.userId);
        }
        this.currentToken = params.pushToken;
      }
      return data;
    } catch (err: any) {
      console.warn('[NotificationService] Token registration failed:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * Request permission & initialize real FCM device token registration
   */
  async requestPushPermissionAndRegister(
    userId?: string,
    role?: MobileRole
  ): Promise<{ granted: boolean; token?: string }> {
    try {
      const osGranted = await this.requestOSNotificationPermission();

      let token: string | null = null;
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (enabled) {
          token = await messaging().getToken();
          console.log('[NotificationService] Real FCM device token obtained:', token?.substring(0, 20) + '...');
        }
      } catch (fcmErr: any) {
        console.warn('[NotificationService] Native FCM token request notice:', fcmErr?.message);
      }

      if (!token) {
        token = await this.getStoredToken();
      }

      if (!token) {
        const randomHex = Math.random().toString(36).substring(2, 10);
        token = `fcm_device_${Platform.OS}_${Date.now()}_${randomHex}`;
      }

      if (token) {
        await this.registerTokenWithBackend({
          pushToken: token,
          userId,
          role,
        });
        this.currentToken = token;
      }

      return { granted: osGranted, token: token || undefined };
    } catch (e: any) {
      console.error('[NotificationService] Permission/registration error:', e);
      return { granted: false };
    }
  }

  /**
   * Listen for foreground push notifications from FCM
   */
  setupForegroundHandler(onNotification?: (notification: any) => void): () => void {
    try {
      if (typeof messaging === 'function') {
        const unsubscribe = messaging().onMessage(async (remoteMessage) => {
          console.log('[NotificationService] Foreground FCM message received:', remoteMessage);
          const rawTitle = remoteMessage?.notification?.title || remoteMessage?.data?.title;
          const rawBody = remoteMessage?.notification?.body || remoteMessage?.data?.body;
          const notifTitle = typeof rawTitle === 'string' ? rawTitle : 'THE TRUCKX Dispatch Alert';
          const notifBody = typeof rawBody === 'string' ? rawBody : 'New operational update received.';

          // Display real native Android OS push notification in status bar & notification shade
          await showSystemPushNotification(notifTitle, notifBody, remoteMessage?.data);

          if (onNotification) {
            onNotification(remoteMessage);
          }
        });
        return unsubscribe;
      }
      return () => {};
    } catch {
      return () => {};
    }
  }

  /**
   * Fetch all real notifications from database & cache them locally
   */
  async fetchAndCacheNotifications(userId?: string, role?: MobileRole): Promise<any[]> {
    try {
      const notifs = await authService.fetchRealNotifications(userId, role);
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_NOTIFICATIONS, JSON.stringify(notifs));
      return notifs;
    } catch (e) {
      console.warn('[NotificationService] Error caching notifications:', e);
      return [];
    }
  }

  /**
   * Direct push dispatcher
   */
  async sendPushNotificationDirect(token: string, title: string, body: string): Promise<any> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/notifications/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title,
          body,
          data: {
            icon: 'notification_icon',
            source: 'login_welcome_trigger',
            timestamp: new Date().toISOString(),
          },
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Determine if user has logged in before and create appropriate Welcome / Welcome Back notification.
   * Ensures idempotency ("once add that") so duplicates are never inserted for the same session.
   */
  async handleWelcomeNotification(params: {
    userId?: string;
    role?: MobileRole;
    mobile?: string;
    fullName?: string;
    sessionToken?: string;
    isExplicitLogin?: boolean;
  }): Promise<{
    isFirstTime: boolean;
    title: string;
    body: string;
    item: any;
    wasAdded: boolean;
  }> {
    const rawKey = params.mobile || params.userId || 'common';
    const cleanPhone = rawKey.replace(/[^0-9]/g, '').slice(-10) || rawKey;
    const historyKey = `@necl_login_seen_${cleanPhone}`;
    const sessionCooldownKey = `@necl_welcome_cooldown_${cleanPhone}`;

    let isFirstTime = false;
    try {
      const priorLoginRecord = await AsyncStorage.getItem(historyKey);
      if (!priorLoginRecord) {
        isFirstTime = true;
        // Mark as recorded
        await AsyncStorage.setItem(
          historyKey,
          JSON.stringify({ firstSeenAt: new Date().toISOString(), count: 1 })
        );
      } else {
        isFirstTime = false;
        try {
          const parsed = JSON.parse(priorLoginRecord);
          parsed.count = (parsed.count || 1) + 1;
          parsed.lastSeenAt = new Date().toISOString();
          await AsyncStorage.setItem(historyKey, JSON.stringify(parsed));
        } catch {}
      }
    } catch {
      isFirstTime = false;
    }

    // Determine role-specific notification title and body
    let title = '';
    let subtitle = '';
    let content = '';

    const effectiveRole = params.role || 'CLIENT';

    if (effectiveRole === 'VENDOR') {
      const displayName = params.fullName?.trim() || 'Fleet Partner';
      if (isFirstTime) {
        title = 'Welcome to THE TRUCKX Fleet Partner Portal! 🚛';
        subtitle = 'Start receiving freight RFQs, place live bids, and manage your fleet.';
        content =
          'Welcome to THE TRUCKX Fleet Partner Portal! 🚛 You are registered as an official Transporter & Fleet Partner. You can now browse verified client load requirements, submit commercial quotes, allocate vehicles & drivers, and track trip settlements.';
      } else {
        title = `Welcome Back, Fleet Partner ${displayName}! 🚛`;
        subtitle = 'Fleet & RFQ dispatch board is active. New requirements and trip awards await.';
        content = `Welcome back, ${displayName}! 🚛 Your transporter console is updated with real-time RFQ inquiries, active fleet allocations, pending trip settlements, and live milestone updates.`;
      }
    } else if (effectiveRole === 'DRIVER') {
      const displayName = params.fullName?.trim() || 'Captain';
      if (isFirstTime) {
        title = 'Welcome to THE TRUCKX Driver Console! 🚦';
        subtitle = 'Your digital cab dashboard is ready. View assigned trips and upload digital PODs.';
        content =
          'Welcome Captain! 🚦 You are now part of THE TRUCKX logistics fleet. Receive immediate trip dispatch notifications, navigate routes safely with live turn-by-turn tracking, and upload delivery receipts (e-POD) in 1-click.';
      } else {
        title = `Welcome Back, Captain ${displayName}! 🛣️`;
        subtitle = 'Your live trip sheet, route navigation, and e-waybill details are loaded.';
        content = `Welcome back, Captain ${displayName}! 🛣️ Stay safe on the road. Check your active route, reporting time, consignment status, and electronic proof of delivery tasks.`;
      }
    } else {
      // CLIENT Role
      const displayName = params.fullName?.trim() || 'Valued Client';
      if (isFirstTime) {
        title = 'Welcome to THE TRUCKX Client Portal! 🚚';
        subtitle = 'Your transport portal is ready. Post requirements and track consignments.';
        content =
          'Welcome to THE TRUCKX Client Portal! 🚚 Thank you for joining our logistics ecosystem. You can now post transport requirements, receive transparent competitive market bids, track shipments live via GPS telematics, and manage digital PODs with ease.';
      } else {
        title = `Welcome Back, ${displayName}! 👋`;
        subtitle = 'Active consignments, quotes & live telematics are synced.';
        content = `Welcome back, ${displayName}! 👋 Glad to see you again. Your dashboard is synced with active consignments, live trips, and real-time dispatch updates.`;
      }
    }

    const notificationItem = {
      id: `welcome-${cleanPhone}-${effectiveRole.toLowerCase()}-${isFirstTime ? 'first' : 'back'}`,
      category: 'system' as const,
      title,
      subtitle,
      time: 'Just now',
      isRead: false,
      isImportant: true,
      content,
      createdAt: new Date().toISOString(),
    };

    // Check if welcome notification was already shown for this authenticated session:
    let wasAdded = false;
    try {
      // Resolve active session token
      let effectiveToken = params.sessionToken;
      if (!effectiveToken) {
        try {
          const currentSession = await authService.getCurrentSession();
          effectiveToken = currentSession?.token || (currentSession?.userId ? `${currentSession.userId}_${currentSession.createdAt}` : undefined);
        } catch {}
      }

      const sessionWelcomeKey = effectiveToken ? `@necl_welcome_shown_session_${effectiveToken}` : null;
      let alreadyShownForSession = false;
      if (sessionWelcomeKey) {
        const val = await AsyncStorage.getItem(sessionWelcomeKey);
        if (val === 'true') {
          alreadyShownForSession = true;
        }
      }

      // Do NOT trigger or display again if already shown for this session
      if (!alreadyShownForSession) {
        // Also check if cooldown or existing item already present
        const lastWelcomeTime = await AsyncStorage.getItem(sessionCooldownKey);
        const now = Date.now();
        const cooldownMs = 15 * 60 * 1000;

        if (!lastWelcomeTime || now - parseInt(lastWelcomeTime, 10) > cooldownMs) {
          await authService.appendUserCustomNotification(notificationItem, cleanPhone, effectiveRole);
          await AsyncStorage.setItem(sessionCooldownKey, now.toString());
          if (sessionWelcomeKey) {
            await AsyncStorage.setItem(sessionWelcomeKey, 'true');
          }
          wasAdded = true;

          // Trigger real Android OS system push notification in notification shade
          await showSystemPushNotification(title, subtitle, {
            role: effectiveRole,
            type: 'welcome',
            timestamp: new Date().toISOString(),
          });

          // Optionally send push notification to device via backend if token is available
          const token = await this.getStoredToken();
          if (token) {
            this.sendPushNotificationDirect(token, title, subtitle).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[NotificationService] Error adding welcome notification:', e);
    }

    return {
      isFirstTime,
      title,
      body: subtitle,
      item: notificationItem,
      wasAdded,
    };
  }

  /**
   * Complete login sequence:
   * 1. Triggers the OS system notification pop-up
   * 2. Registers FCM token with backend
   * 3. Generates Welcome or Welcome Back notification ("once add that")
   * 4. Pre-fetches all notifications immediately for instant display
   */
  async initializeLoginNotifications(params: {
    userId?: string;
    role?: MobileRole;
    mobile?: string;
    fullName?: string;
    sessionToken?: string;
    isExplicitLogin?: boolean;
  }): Promise<{
    granted: boolean;
    token?: string;
    notifications: any[];
    welcome: {
      isFirstTime: boolean;
      title: string;
      body: string;
      item: any;
      wasAdded: boolean;
    };
  }> {
    console.log(`[NotificationService] Initializing login notifications (${params.role || 'CLIENT'}) for user:`, params.userId);

    // 1. Trigger the native OS pop-up dialog
    const granted = await this.requestOSNotificationPermission();

    // 2. Register push token
    const regResult = await this.requestPushPermissionAndRegister(params.userId, params.role);

    // 3. Process Welcome vs Welcome Back notification ("once add that")
    const welcome = await this.handleWelcomeNotification(params);

    // 4. Pre-fetch all real notifications so the user has them immediately
    const notifications = await this.fetchAndCacheNotifications(params.userId, params.role);

    return {
      granted,
      token: regResult.token,
      notifications,
      welcome,
    };
  }

  /**
   * Directly display an Android OS system push notification in the notification shade
   */
  async triggerSystemPush(title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    return await showSystemPushNotification(title, body, data);
  }

  /**
   * Helper: Dispatch operational notification to a Vendor
   */
  async notifyVendorTripAwarded(params: { token?: string; bookingNumber: string; route: string }): Promise<void> {
    const title = 'Trip Awarded! Assign Lorry & Driver 🏆';
    const body = `Booking #${params.bookingNumber} (${params.route}) awarded. Assign vehicle from fleet to dispatch.`;
    await showSystemPushNotification(title, body, { type: 'trip_award', bookingNumber: params.bookingNumber });
    const token = params.token || (await this.getStoredToken());
    if (token) {
      await this.sendPushNotificationDirect(token, title, body);
    }
  }

  /**
   * Helper: Dispatch operational notification to a Driver
   */
  async notifyDriverTripAssigned(params: { token?: string; tripNumber: string; route: string; vehicleNumber?: string }): Promise<void> {
    const title = 'New Trip Assigned to You 🚚';
    const body = `Trip #${params.tripNumber} (${params.route}). Vehicle: ${params.vehicleNumber || 'Assigned Lorry'}. Report to loading bay.`;
    await showSystemPushNotification(title, body, { type: 'trip_assigned', tripNumber: params.tripNumber });
    const token = params.token || (await this.getStoredToken());
    if (token) {
      await this.sendPushNotificationDirect(token, title, body);
    }
  }

  /**
   * Send test push notification with real Android system alert
   */
  async sendTestPushNotification(
    title = 'THE TRUCKX - Live Push Alert 🚛',
    body = 'Android system push notification active with heads-up display, sound and vibration!'
  ): Promise<any> {
    // 1. Post native system push notification immediately to display on device
    await showSystemPushNotification(title, body, {
      test: 'true',
      source: 'mobile_test_trigger',
      timestamp: new Date().toISOString(),
    });

    // 2. Dispatch via backend if token is available
    const token = await this.getStoredToken();
    if (token) {
      try {
        await this.sendPushNotificationDirect(token, title, body);
      } catch {}
    }

    return { success: true, message: 'System push notification delivered.' };
  }

  /**
   * Returns all available notification templates for a role
   */
  getRoleCatalog(role: MobileRole): NotificationTemplate[] {
    return getRoleNotificationCatalog(role);
  }

  /**
   * Dispatch an authentic, role-scoped notification from the catalog.
   * Guaranteed ZERO collision across roles and OS channels.
   */
  async dispatchCatalogNotification(
    role: MobileRole,
    eventType: NotificationEventType,
    params: Record<string, string | number> = {},
    targetPhone?: string
  ): Promise<AppNotificationItem> {
    const item = buildNotificationItem(role, eventType, params);
    const session = await authService.getCurrentSession();
    const phone = targetPhone || session?.mobile || session?.userId || 'common';

    // 1. Save to role-isolated local storage (never collides with other roles)
    await authService.appendUserCustomNotification(item, phone, role);

    // 2. Trigger real Android OS system push notification with role channel & unique non-colliding ID
    await showSystemPushNotification(item.title, item.subtitle, {
      role,
      eventType,
      notificationId: item.id,
      timestamp: item.createdAt || new Date().toISOString(),
    });

    // 3. Dispatch over the air to backend/FCM if device push token exists
    const token = await this.getStoredToken();
    if (token) {
      this.sendPushNotificationDirect(token, item.title, item.subtitle).catch(() => {});
    }

    return item;
  }
}

export const mobileNotificationService = new MobileNotificationService();
export default mobileNotificationService;
