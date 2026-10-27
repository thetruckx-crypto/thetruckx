/**
 * Firebase Client & Cloud Messaging (FCM) Integration
 * NECL Admin Web Console
 * Project: thetruckx-f03e3
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported, Messaging } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAdnM5IIi0BWvpL-C-2U0whibG486o83Vo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "thetruckx-f03e3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "thetruckx-f03e3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "thetruckx-f03e3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "165741932326",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:165741932326:web:98f63b0e580d945e411be7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0L1QNM5CY8"
};

// Initialize Firebase App (Singleton safe)
export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Analytics instance (safely checks browser support)
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn('[Firebase] Analytics initialization warning:', err);
      }
    }
  });
}

// Messaging instance getter
let messagingInstance: Messaging | null = null;
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  try {
    const supported = await isMessagingSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[Firebase] FCM messaging is not supported in this browser context:', err);
  }
  return null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Register the browser FCM token with NECL Backend Notification Registry
 */
export async function registerWebFCMTokenWithBackend(token: string, adminId?: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pushToken: token,
        userId: adminId || 'admin_user',
        role: 'ADMIN',
        platform: 'web',
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('[Firebase] Backend token registration failed:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Request browser push notification permission and obtain FCM token
 */
export async function requestWebPushPermission(adminId?: string): Promise<{
  granted: boolean;
  token: string | null;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, token: null, error: 'Push notifications not supported in this browser' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { granted: false, token: null, error: 'Notification permission denied by user' };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { granted: false, token: null, error: 'Firebase messaging not supported' };
    }

    // Register service worker if not already registered
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[Firebase] Service worker registration warning:', swErr);
      }
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      localStorage.setItem('necl_web_fcm_token', token);
      await registerWebFCMTokenWithBackend(token, adminId);
      return { granted: true, token };
    }

    return { granted: false, token: null, error: 'Failed to retrieve FCM registration token' };
  } catch (err: any) {
    console.error('[Firebase] Error requesting web push permission:', err);
    return { granted: false, token: null, error: err.message || 'Unknown error requesting token' };
  }
}

/**
 * Listen for foreground push notifications
 */
export async function setupForegroundNotificationListener(
  onNotificationReceived: (payload: { title: string; body: string; data?: any }) => void
): Promise<(() => void) | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Firebase FCM] Foreground notification received:', payload);
      const title = payload.notification?.title || payload.data?.title || 'NECL Notification';
      const body = payload.notification?.body || payload.data?.body || '';

      // Trigger user callback
      onNotificationReceived({
        title,
        body,
        data: payload.data,
      });

      // Also trigger browser desktop notification if permitted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            data: payload.data,
          });
        } catch {
          // Some browsers restrict new Notification in foreground
        }
      }
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase] Error attaching foreground message listener:', err);
    return null;
  }
}

/**
 * Helper to dispatch a test push notification to this web browser
 */
export async function sendTestWebPushNotification(title = 'NECL Web Push Alert', body = 'Firebase FCM push notification is working perfectly!'): Promise<any> {
  const token = localStorage.getItem('necl_web_fcm_token');
  if (!token) {
    throw new Error('No registered browser token found. Please enable web push notifications first.');
  }

  const res = await fetch(`${API_BASE_URL}/notifications/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title,
      body,
      data: {
        source: 'test_dispatch',
        timestamp: new Date().toISOString(),
      },
    }),
  });

  return await res.json();
}
