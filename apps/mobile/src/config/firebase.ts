/**
 * Firebase & FCM Push Notification Configuration for Mobile
 * Project: thetruckx-f03e3
 */

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAdnM5IIi0BWvpL-C-2U0whibG486o83Vo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "thetruckx-f03e3.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "thetruckx-f03e3",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "thetruckx-f03e3.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "165741932326",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:165741932326:web:98f63b0e580d945e411be7",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0L1QNM5CY8",
};

export const googleServicesConfig = {
  projectNumber: "165741932326",
  projectId: "thetruckx-f03e3",
  storageBucket: "thetruckx-f03e3.firebasestorage.app",
  packageName: "com.thetruckx",
  mobileSdkAppId: "1:165741932326:android:f143e4bbba8683a4411be7",
  currentKey: "AIzaSyD6YPRqgVjMlDUdfcgMic3_WHx_PPdzTo0",
};

export default firebaseConfig;
