// db.js — Firebase Realtime Database para Rogasa Café Delivery
// Sincronización en tiempo real compatible con todos los navegadores móviles (Safari/iOS)

const firebaseConfig = {
    apiKey: "AIzaSyDViZSKtfnEVnDL1GEF4iOl9kUp043Y3mw",
    authDomain: "rogasa-delivery.firebaseapp.com",
    databaseURL: "https://rogasa-delivery-default-rtdb.firebaseio.com",
    projectId: "rogasa-delivery",
    storageBucket: "rogasa-delivery.firebasestorage.app",
    messagingSenderId: "67005464439",
    appId: "1:67005464439:web:7ce4db453342c3f4e6ab72"
};

// Initialize Firebase using global window.firebase
// Guard: si el SDK de Firebase no carga (sin red / CDN bloqueado), la app
// sigue funcionando de forma degradada (menú visible, pedidos sin sync).
const firebase = window.firebase;
let app = null;
let database = null;
if (firebase && firebase.initializeApp) {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
    database = firebase.database();
} else {
    console.warn('Firebase SDK no disponible — la app funcionará sin sincronización en tiempo real.');
}

// === NOTIFICACIONES PUSH (FCM) ===
// La app registra un service worker y obtiene un token por dispositivo. Ese token se
// guarda en el pedido; cuando el estado cambia, una Cloud Function envía el push.
//
// VAPID: llave pública del proyecto. Está en Firebase Console → Project settings →
// Cloud Messaging → Web Push certificates → Key pair. Sin ella, FCM no puede enviar
// push con la app cerrada, y la app cae automáticamente al modo "pestaña abierta"
// (notificaciones del sistema mientras la página de seguimiento siga abierta).
const FCM_VAPID_KEY = 'BDAoUZbW6GaJSWyuTIxfAvqlHj2Wx212QheNV-1lIQLuaiLQZ_Bbm8pRk2PB_0nnk9_AV1VuL5Ot01SI1MGj0po';

let messaging = null;
let fcmEnabled = false;
if (firebase && firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported()) {
    try {
        messaging = firebase.messaging();
    } catch (e) {
        console.warn('FCM no disponible en este navegador:', e);
    }
}

async function fcmInit(onForeground) {
    if (!messaging || !('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        let perm = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm !== 'granted') return null;
        if (!FCM_VAPID_KEY || FCM_VAPID_KEY.startsWith('REEMPLAZAR')) {
            console.warn('VAPID key sin configurar — se usará el modo sin servidor (notificaciones solo con la pestaña abierta).');
            return null;
        }
        const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
        fcmEnabled = true;
        if (onForeground) messaging.onMessage((payload) => onForeground(payload));
        return token;
    } catch (e) {
        console.warn('FCM init falló:', e);
        return null;
    }
}

async function fcmActualizarToken(orderId, token) {
    if (!database || !orderId || !token) return false;
    try {
        await database.ref('orders/' + orderId).update({ token });
        return true;
    } catch (e) {
        console.error('FCM token write error:', e);
        return false;
    }
}

export const db = {

    generarIdUnico() {
        return 'ord_' + Math.random().toString(36).substring(2, 8);
    },

    async crearPedido({ id, restaurante, cliente_nombre, ubicacion, telefono, metodo_pago, total_usd, total_bs, items }) {
        const nuevoPedido = {
            id: id || this.generarIdUnico(),
            restaurante: restaurante || 'rogasa',
            cliente_nombre,
            ubicacion,
            telefono,
            metodo_pago,
            total_usd,
            total_bs,
            items,
            estado: 'recibido',
            creado_en: new Date().toISOString()
        };

        if (!database) {
            console.warn('Firebase no disponible: el pedido no se guardará en la nube.');
            return nuevoPedido;
        }

        try {
            await database.ref('orders/' + nuevoPedido.id).set(nuevoPedido);
        } catch (e) {
            console.error('Firebase write error:', e);
        }

        return nuevoPedido;
    },

    async obtenerPedido(id) {
        if (!database) return null;
        try {
            const snapshot = await database.ref('orders/' + id).get();
            if (snapshot.exists()) return snapshot.val();
        } catch (e) {
            console.error('Firebase read error:', e);
        }
        return null;
    },

    async obtenerPedidosActivos() {
        if (!database) return [];
        try {
            const snapshot = await database.ref('orders').get();
            if (snapshot.exists()) return Object.values(snapshot.val());
        } catch (e) {
            console.error('Firebase read error:', e);
        }
        return [];
    },

    async actualizarEstado(id, nuevoEstado) {
        if (!database) return null;
        try {
            await database.ref('orders/' + id).update({ estado: nuevoEstado });
            const snapshot = await database.ref('orders/' + id).get();
            return snapshot.exists() ? snapshot.val() : null;
        } catch (e) {
            console.error('Firebase update error:', e);
            return null;
        }
    },

    // Marca el estado que ya fue notificado por push (evita duplicados).
    // Lo escribe el panel de Cocina tras enviar el FCM.
    async marcarNotificado(id, estado) {
        if (!database || !id || !estado) return false;
        try {
            await database.ref('orders/' + id).update({ notified_estado: estado });
            return true;
        } catch (e) {
            console.error('Firebase update error (notified):', e);
            return false;
        }
    },

    suscribirAPedido(id, callback) {
        if (!database) {
            callback(null);
            return () => {};
        }
        const orderRef = database.ref('orders/' + id);
        orderRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
        return () => orderRef.off('value');
    },

    suscribirATodosLosPedidos(callback) {
        if (!database) {
            callback([]);
            return () => {};
        }
        const ordersRef = database.ref('orders');
        ordersRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                callback(Object.values(snapshot.val()));
            } else {
                callback([]);
            }
        });
        return () => ordersRef.off('value');
    },

    // === MULTI-TENANT ===
    // Cada restaurante vive en /restaurantes/{tenant}/ con su menu y su config.
    // El menú por defecto del código es el fallback si el nodo aún no existe.

    async obtenerRestaurante(tenant) {
        if (!database) return null;
        try {
            const snapshot = await database.ref('restaurantes/' + tenant).get();
            if (snapshot.exists()) return snapshot.val();
        } catch (e) {
            console.error('Firebase read error (restaurante):', e);
        }
        return null;
    },

    async guardarMenu(tenant, menu) {
        if (!database) return false;
        try {
            await database.ref('restaurantes/' + tenant + '/menu').set(menu);
            return true;
        } catch (e) {
            console.error('Firebase write error (menu):', e);
            return false;
        }
    },

    async guardarConfig(tenant, config) {
        if (!database) return false;
        try {
            await database.ref('restaurantes/' + tenant + '/config').set(config);
            return true;
        } catch (e) {
            console.error('Firebase write error (config):', e);
            return false;
        }
    },

    async eliminarRestaurante(tenant) {
        if (!database) return false;
        try {
            await database.ref('restaurantes/' + tenant).set(null);
            return true;
        } catch (e) {
            console.error('Firebase delete error (restaurante):', e);
            return false;
        }
    },

    // === FCM ===
    initFCM: fcmInit,
    actualizarToken: fcmActualizarToken,
    fcmEnabled: () => fcmEnabled
};
