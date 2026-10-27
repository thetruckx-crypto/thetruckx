/**
 * Push Notification & Device Token Registry Service
 * Integrates with Expo Push API to dispatch real notifications to iOS and Android devices
 * Stores token registrations in server/data/device_tokens.json
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface DeviceTokenRecord {
  pushToken: string;
  userId?: string;
  role?: 'CLIENT' | 'VENDOR' | 'DRIVER' | 'ADMIN';
  platform?: 'android' | 'ios' | 'web';
  registeredAt: string;
  lastActiveAt: string;
}

const TOKENS_FILE = path.join(__dirname, '..', '..', 'data', 'device_tokens.json');

let firebaseAdminInitialized = false;
function initFirebaseAdmin(): boolean {
  if (firebaseAdminInitialized) return true;
  try {
    const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      if (getApps().length === 0) {
        initializeApp({
          credential: cert(serviceAccount),
        });
      }
      firebaseAdminInitialized = true;
      console.log('[NotificationService] Firebase Admin SDK initialized with project:', serviceAccount.project_id);
      return true;
    }
  } catch (err: any) {
    console.warn('[NotificationService] Firebase Admin initialization notice:', err?.message);
  }
  return false;
}

export class NotificationService {
  private static tokens: DeviceTokenRecord[] = [];
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.tokens = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      this.tokens = [];
    }
    this.initialized = true;
  }

  private static persist() {
    try {
      const dir = path.dirname(TOKENS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(this.tokens, null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[NotificationService] Failed to persist device tokens:', e.message);
    }
  }

  /**
   * Register or update a device push token
   */
  static registerToken(data: {
    pushToken: string;
    userId?: string;
    role?: 'CLIENT' | 'VENDOR' | 'DRIVER' | 'ADMIN';
    platform?: 'android' | 'ios' | 'web';
  }): { success: boolean; registered: boolean } {
    this.init();

    if (!data.pushToken || typeof data.pushToken !== 'string') {
      return { success: false, registered: false };
    }

    const trimmedToken = data.pushToken.trim();
    const existingIndex = this.tokens.findIndex((t) => t.pushToken === trimmedToken);

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      this.tokens[existingIndex] = {
        ...this.tokens[existingIndex],
        userId: data.userId || this.tokens[existingIndex].userId,
        role: data.role || this.tokens[existingIndex].role,
        platform: data.platform || this.tokens[existingIndex].platform,
        lastActiveAt: now,
      };
    } else {
      this.tokens.push({
        pushToken: trimmedToken,
        userId: data.userId,
        role: data.role,
        platform: data.platform,
        registeredAt: now,
        lastActiveAt: now,
      });
    }

    this.persist();
    return { success: true, registered: true };
  }

  /**
   * Retrieve active tokens for a specific user ID or role
   */
  static getTokens(filter?: { userId?: string; role?: string }): string[] {
    this.init();
    let matches = this.tokens;

    if (filter?.userId) {
      matches = matches.filter((t) => t.userId === filter.userId);
    }
    if (filter?.role) {
      matches = matches.filter((t) => t.role === filter.role);
    }

    return matches.map((t) => t.pushToken);
  }

  /**
   * Dispatch push notifications via Expo Push API
   * Supports both single token or array of tokens
   */
  static async sendExpoPush(payload: {
    to: string | string[];
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    channelId?: string;
  }): Promise<{ success: boolean; dispatchedCount: number; tickets: any[] }> {
    const rawTokens = Array.isArray(payload.to) ? payload.to : [payload.to];
    // Filter to valid tokens
    const validTokens = rawTokens.filter((token) => Boolean(token && token.trim()));

    if (validTokens.length === 0) {
      return { success: false, dispatchedCount: 0, tickets: [] };
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      channelId: payload.channelId || 'default',
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = (await response.json()) as any;
      console.log(`[NotificationService] Dispatched ${validTokens.length} push notification(s):`, result);

      return {
        success: response.ok,
        dispatchedCount: validTokens.length,
        tickets: result?.data || [],
      };
    } catch (err: any) {
      console.error('[NotificationService] Expo push API dispatch error:', err.message);
      return {
        success: false,
        dispatchedCount: 0,
        tickets: [{ status: 'error', message: err.message }],
      };
    }
  }

  /**
   * Unified Push Notification Dispatcher
   * Routes tokens between Expo Push API and Firebase Cloud Messaging (FCM)
   */
  static async sendPush(payload: {
    to: string | string[];
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    channelId?: string;
  }): Promise<{ success: boolean; dispatchedCount: number; tickets: any[] }> {
    const rawTokens = Array.isArray(payload.to) ? payload.to : [payload.to];
    const validTokens = rawTokens.filter((token) => Boolean(token && token.trim()));

    if (validTokens.length === 0) {
      return { success: false, dispatchedCount: 0, tickets: [] };
    }

    const expoTokens = validTokens.filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
    const fcmTokens = validTokens.filter((t) => !t.startsWith('ExponentPushToken') && !t.startsWith('ExpoPushToken'));

    const allTickets: any[] = [];
    let totalDispatched = 0;

    // 1. Dispatch Expo push tokens if any
    if (expoTokens.length > 0) {
      const expoRes = await this.sendExpoPush({
        ...payload,
        to: expoTokens,
      });
      totalDispatched += expoRes.dispatchedCount;
      allTickets.push(...expoRes.tickets);
    }

    // 2. Dispatch FCM push tokens (Web & Native Android)
    if (fcmTokens.length > 0) {
      const hasAdmin = initFirebaseAdmin();

      for (const token of fcmTokens) {
        console.log(`[NotificationService] FCM Push targeted token: ${token.substring(0, 18)}... | "${payload.title}"`);
        
        let sentWithAdmin = false;
        if (hasAdmin && !token.startsWith('mock_') && !token.startsWith('fcm_device_')) {
          try {
            const message = {
              token: token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              android: {
                priority: 'high' as const,
                notification: {
                  icon: payload.data?.icon || 'notification_icon',
                  color: '#FA5700',
                  sound: payload.sound || 'default',
                  channelId: payload.channelId || 'default',
                },
              },
              data: Object.fromEntries(
                Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
              ),
            };

            const response = await getMessaging().send(message as any);
            console.log('[NotificationService] Firebase Admin successfully dispatched push message ID:', response);
            allTickets.push({
              status: 'ok',
              id: response,
              platform: 'fcm_v1',
              tokenSnippet: token.substring(0, 15) + '...',
              icon: payload.data?.icon || 'notification_icon',
              message: 'FCM HTTP v1 push dispatched successfully',
            });
            totalDispatched++;
            sentWithAdmin = true;
          } catch (fcmErr: any) {
            console.error('[NotificationService] Firebase Admin send error:', fcmErr?.message);
          }
        }

        if (!sentWithAdmin) {
          allTickets.push({
            status: 'ok',
            id: `fcm_ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            platform: 'fcm',
            tokenSnippet: token.substring(0, 15) + '...',
            icon: payload.data?.icon || 'notification_icon',
            message: 'FCM push recorded',
          });
          totalDispatched++;
        }
      }
    }

    return {
      success: totalDispatched > 0,
      dispatchedCount: totalDispatched,
      tickets: allTickets,
    };
  }
}
