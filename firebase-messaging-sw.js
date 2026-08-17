// firebase-messaging-sw.js
// Service Worker de Firebase Cloud Messaging — muestra la notificación del sistema
// cuando la app está cerrada o en segundo plano y llega un cambio de estado del pedido.
// Debe estar junto a index.html (mismo alcance) para que la app lo registre.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Misma configuración que db-v2.js (el SW no puede importar módulos ES de la app)
firebase.initializeApp({
  apiKey: 'AIzaSyDViZSKtfnEVnDL1GEF4iOl9kUp043Y3mw',
  authDomain: 'rogasa-delivery.firebaseapp.com',
  databaseURL: 'https://rogasa-delivery-default-rtdb.firebaseio.com',
  projectId: 'rogasa-delivery',
  storageBucket: 'rogasa-delivery.firebasestorage.app',
  messagingSenderId: '67005464439',
  appId: '1:67005464439:web:7ce4db453342c3f4e6ab72'
});

const messaging = firebase.messaging();

// Mensaje recibido con la app cerrada o en segundo plano
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = (payload.notification && payload.notification.title) || 'Tu pedido avanza';
  const body = (payload.notification && payload.notification.body) || '';
  const url = data.url || self.registration.scope;

  self.registration.showNotification(title, {
    body: body,
    icon: './img/logo_clean.png',
    badge: './img/logo_clean.png',
    sound: './img/notif-ding.wav',
    vibrate: [180, 90, 180],
    tag: data.orderId || 'pedido',
    renotify: true,
    data: { url: url }
  });
});

// Al tocar la notificación → abrir el seguimiento del pedido
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
