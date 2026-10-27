import { registerRootComponent } from 'expo';
import App from './App';

// Register background message handler for Firebase Cloud Messaging
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM] Push message received in background:', remoteMessage?.notification?.title);
  });
} catch (e) {
  console.warn('[FCM] Background handler initialization notice:', e ? e.message : e);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
