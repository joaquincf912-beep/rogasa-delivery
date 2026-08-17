// Cloud Function: envía una notificación push (FCM) al cliente cuando su pedido
// cambia de estado. Despliegue: `firebase deploy --only functions` (ver README).
//
// Requisitos:
//  1. El cliente activó notificaciones y su token quedó guardado en el pedido
//     (campo `token`, lo escribe la app en /orders/{id} al hacer checkout).
//  2. Este proyecto de Firebase tiene Cloud Functions habilitado (plan Spark
//     incluye 2M de invocaciones gratis al mes).

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const STATUS_TITLES = {
  recibido: 'Pedido recibido',
  pago_confirmado: 'Pago confirmado',
  cocina: 'En cocina',
  reparto: 'En camino',
  entregado: 'Entregado'
};

const STATUS_LABELS = {
  recibido: 'Tu pedido ha sido recibido.',
  pago_confirmado: 'Tu pago ha sido confirmado.',
  cocina: 'Estamos preparando tu pedido.',
  reparto: 'Tu pedido está en camino.',
  entregado: 'Tu pedido ha sido entregado. ¡Buen provecho!'
};

// URL base de la app (misma que usa el checkout). Si cambias de dominio, actualiza aquí.
const APP_URL = 'https://menu.traccionweb.com/delivery/';

exports.notificarCambioEstado = functions.database
  .ref('/orders/{orderId}')
  .onWrite(async (change) => {
    const order = change.after.val();
    if (!order) return null; // el pedido fue eliminado

    const before = change.before.val();
    if (!before) return null; // creación del pedido: el cliente ya lo sabe, no spamear
    if (before.estado === order.estado) return null; // no hubo cambio de estado
    if (!order.token) return null; // el cliente no activó las notificaciones

    const estado = order.estado || 'recibido';
    const tenant = (order.restaurante && order.restaurante !== 'rogasa') ? ('&t=' + order.restaurante) : '';
    const url = APP_URL + '?id=' + order.id + tenant;

    const message = {
      token: order.token,
      notification: {
        title: STATUS_TITLES[estado] || 'Tu pedido avanza',
        body: STATUS_LABELS[estado] || 'Tu pedido ha cambiado de estado.'
      },
      data: {
        orderId: order.id,
        estado: estado,
        url: url
      }
    };

    try {
      await admin.messaging().send(message);
    } catch (e) {
      // Tokens inválidos o revocados se ignoran silenciosamente
      console.error('FCM send error:', e.errorInfo ? e.errorInfo.code : e.message);
    }
    return null;
  });
