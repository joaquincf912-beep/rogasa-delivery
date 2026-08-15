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
