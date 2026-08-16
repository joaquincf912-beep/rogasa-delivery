# Rogasa Café — Proyecto de Domicilios (Delivery) standalone

Esta carpeta contiene todo lo necesario para el funcionamiento de la aplicación de domicilios de Rogasa Café, incluyendo la interfaz, la base de datos local y el servidor de respaldo.

## Estructura de la Carpeta

1. **`index.html`**: La aplicación web completa (SPA) optimizada para dispositivos móviles.
2. **`db-v3.js`**: El módulo de base de datos conectado a Google Firebase Realtime Database para sincronización global y en tiempo real. (Nombre versionado a propósito: evita que Cloudflare sirva una copia vieja en caché tras cada despliegue.)
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

## 🔔 Notificaciones Push (FCM)

La app ya incluye todo el lado del cliente de las notificaciones push:

- **`firebase-messaging-sw.js`**: service worker que muestra la notificación cuando la app está cerrada.
- **`db-v3.js`**: pide permiso al hacer checkout y guarda el token del dispositivo en el pedido (VAPID key ya configurada).
- **`index.html`**: toast en primer plano + notificación del sistema en segundo plano (modo sin servidor).

### Push desde el panel de Cocina (vía activa, 100% gratis, instantáneo)

Cuando el restaurante cambia el estado de un pedido en el panel de **Cocina**, el
navegador del panel firma un JWT con la cuenta de servicio (WebCrypto) y envía el
push FCM al instante — sin Cloud Functions, sin plan de pago y sin espera.

- La key de la cuenta de servicio está en `PUSH_SA` dentro de `index.html`
  (es lo que permite firmar desde el navegador). Si se rota en Google Cloud,
  hay que actualizar esa constante y volver a desplegar.
- El pedido guarda el token del cliente al hacer checkout; al cambiar el estado,
  Cocina envía la notificación y marca `notified_estado` para **nunca duplicar**.
- App abierta → toast al instante (real-time de la base, independiente del push).
  App cerrada → el service worker muestra la notificación del sistema.

### Referencia: vigilante en GitHub Actions (opcional)

`.github/scripts/fcm_vigilante.py` es un poller alternativo (revisa la base cada
pocos minutos y envía los push pendientes). No está activo; quedó como respaldo
para quien prefiera no depender del navegador de Cocina. Para activarlo se
necesita un workflow en `.github/workflows/` (requiere permiso `workflow` en el
token de GitHub) y la key como secreto del repo `FIREBASE_SA`.

### Opcional: Cloud Function (requiere plan Blaze)

Hay una Cloud Function lista en `functions/` para quienes algún día pasen el
proyecto al plan Blaze:

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase use rogasa-delivery
firebase deploy --only functions
```

### Limitación conocida

iOS Safari: Apple solo permite push web a apps instaladas como PWA (iOS 16.4+); en iPhone normal se muestra el toast dentro de la app.
