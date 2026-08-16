# Rogasa Café — Proyecto de Domicilios (Delivery) standalone

Esta carpeta contiene todo lo necesario para el funcionamiento de la aplicación de domicilios de Rogasa Café, incluyendo la interfaz, la base de datos local y el servidor de respaldo.

## Estructura de la Carpeta

1. **`index.html`**: La aplicación web completa (SPA) optimizada para dispositivos móviles.
2. **`db-v2.js`**: El módulo de base de datos conectado a Google Firebase Realtime Database para sincronización global y en tiempo real.
3. **`server.py`**: El servidor backend local en Python para pruebas y desarrollo.
4. **`orders.json`**: La base de datos local donde el servidor Python guarda todos los pedidos cuando trabajas sin internet o en local.
5. **`img/`**: Carpeta que contiene todas las imágenes optimizadas de los platos.

---

## Cómo Ejecutar el Servidor Local y la Base de Datos

Si quieres probar la app localmente con el servidor Python y guardar los pedidos en `orders.json`:

1. Abre tu terminal de macOS.
2. Ejecuta el servidor corriendo el siguiente comando:
   ```bash
   python3 /Users/apple/Documents/rogasa-delivery/server.py
   ```
3. Abre tu navegador e ingresa a:
   👉 **[http://localhost:8085](http://localhost:8085)**

Todos los pedidos que realices localmente se guardarán de forma automática en el archivo **`orders.json`** en esta misma carpeta.

---

## 🔔 Notificaciones Push (FCM) — Despliegue de la Cloud Function

La app ya incluye todo el lado del cliente de las notificaciones push:

- **`firebase-messaging-sw.js`**: service worker que muestra la notificación cuando la app está cerrada.
- **`db-v2.js`**: pide permiso al hacer checkout y guarda el token del dispositivo en el pedido.
- **`index.html`**: toast en primer plano + notificación del sistema en segundo plano (modo sin servidor).

### ¿Qué falta para que funcionen con la app cerrada? (una sola vez)

1. **Conseguir la VAPID key** (llave pública de Web Push):
   Firebase Console → tu proyecto (`rogasa-delivery`) → **Project settings → Cloud Messaging → Web Push certificates → Key pair**.
   Copia esa llave y pégala en `db-v2.js` reemplazando:
   ```js
   const FCM_VAPID_KEY = 'REEMPLAZAR_CON_LA_VAPID_KEY_DEL_PROYECTO';
   ```
2. **Desplegar la Cloud Function** (gratis, plan Spark incluye 2M de invocaciones/mes):
   ```bash
   npm install -g firebase-tools
   firebase login
   cd functions && npm install && cd ..
   firebase use rogasa-delivery
   firebase deploy --only functions
   ```
3. **Subir el cambio de `db-v2.js`** a GitHub (Vercel lo publica solo).

### Cómo funciona

- Al confirmar un pedido, la app pide permiso de notificaciones y guarda el token del dispositivo en el pedido.
- Cuando el estado cambia en el panel de Cocina (Cocina / Reparto / Entregado), la Cloud Function envía el push al dispositivo del cliente.
- Al tocar la notificación se abre el seguimiento en vivo del pedido.
- **Sin la VAPID key/Cloud Function**, la app usa el modo sin servidor: notificaciones del sistema mientras la pestaña de seguimiento sigue abierta (en segundo plano).
- Limitación de iOS Safari: Apple solo permite push web a apps instaladas como PWA (iOS 16.4+); en iPhone normal se muestra el toast dentro de la app.
