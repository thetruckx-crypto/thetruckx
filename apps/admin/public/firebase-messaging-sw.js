/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications when web admin tab is not active or closed
 * Project: thetruckx-f03e3
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAdnM5IIi0BWvpL-C-2U0whibG486o83Vo",
  authDomain: "thetruckx-f03e3.firebaseapp.com",
  projectId: "thetruckx-f03e3",
  storageBucket: "thetruckx-f03e3.firebasestorage.app",
  messagingSenderId: "165741932326",
  appId: "1:165741932326:web:98f63b0e580d945e411be7",
  measurementId: "G-0L1QNM5CY8"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'NECL Operations Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New operational update received.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window or open new window
      for (let client of windowClients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/admin/dashboard');
      }
    })
  );
});
