import { registerRootComponent } from 'expo';
import App from './App';

// Register background message handler for Firebase Cloud Messaging
try {
  const messaging = require('@react-native-firebase/messaging').default;
  const { NativeModules, Platform } = require('react-native');
  const { PushNotificationModule } = NativeModules || {};

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM] Push message received in background:', remoteMessage?.notification?.title || remoteMessage?.data?.title);
    if (Platform.OS === 'android' && PushNotificationModule?.displayPushNotification) {
      const rawTitle = remoteMessage?.notification?.title || remoteMessage?.data?.title;
      const rawBody = remoteMessage?.notification?.body || remoteMessage?.data?.body;
      const title = typeof rawTitle === 'string' ? rawTitle : 'THE TRUCKX Dispatch Alert';
      const body = typeof rawBody === 'string' ? rawBody : 'New operational update received.';
      try {
        PushNotificationModule.displayPushNotification(title, body, remoteMessage?.data || null);
      } catch (e) {
        console.warn('[FCM] Failed to display background push notification:', e);
      }
    }
  });
} catch (e) {
  console.warn('[FCM] Background handler initialization notice:', e ? e.message : e);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
