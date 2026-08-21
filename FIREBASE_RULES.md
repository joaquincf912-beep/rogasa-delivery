# 🔒 Firebase Security Rules

## Reglas de Seguridad Recomendadas

Para proteger la base de datos contra abuso, configura estas reglas en Firebase Console:

### Realtime Database Rules

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true,
      ".indexOn": ["restaurante", "creado_en", "estado"],
      "$orderId": {
        ".validate": "newData.hasChildren(['id', 'restaurante', 'cliente_nombre', 'telefono', 'items', 'total_usd', 'creado_en'])",
        "cliente_nombre": {
          ".validate": "newData.isString() && newData.val().length >= 2 && newData.val().length <= 100"
        },
        "telefono": {
          ".validate": "newData.isString() && newData.val().length >= 10 && newData.val().length <= 15"
        },
        "total_usd": {
          ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 1000"
        },
        "items": {
          ".validate": "newData.isList() && newData.val().length >= 1 && newData.val().length <= 20"
        }
      }
    },
    "restaurantes": {
      ".read": true,
      "$tenant": {
        ".write": "auth != null && root.child('admins').child(auth.uid).child($tenant).exists()",
        "config": {
          ".read": true,
          ".write": "auth != null && root.child('admins').child(auth.uid).child($tenant).exists()"
        },
        "menu": {
          ".read": true,
          ".write": "auth != null && root.child('admins').child(auth.uid).child($tenant).exists()"
        }
      }
    },
    "admins": {
      ".read": false,
      ".write": false
    }
  }
}
```

### Cloud Storage Rules (si usas imágenes)

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /delivery/{restaurant}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## Rate Limiting en Firebase

### Opción 1: Cloud Functions + Firebase Extensions

```javascript
// functions/rateLimiter.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.rateLimiter = functions.database.ref('/orders/{orderId}')
  .onCreate(async (snapshot, context) => {
    const order = snapshot.val();
    const clientId = order.cliente_nombre + '_' + order.telefono;
    
    // Check rate limit
    const rateRef = admin.database().ref(`rate_limits/${clientId}`);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    const snapshot2 = await rateRef.once('value');
    const timestamps = snapshot2.val() || [];
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(t => t > now - windowMs);
    
    if (validTimestamps.length >= 5) {
      // Too many orders - delete this one
      await snapshot.ref.remove();
      return null;
    }
    
    // Add new timestamp
    validTimestamps.push(now);
    await rateRef.set(validTimestamps);
    
    return null;
  });
```

### Opción 2: Firebase App Check

1. Habilita App Check en Firebase Console
2. Configura reCAPTCHA v3 o Device Check
3. Valida tokens en Cloud Functions

## Optimizaciones de Rendimiento

### 1. Índices en Firebase

```json
{
  "rules": {
    "orders": {
      ".indexOn": ["restaurante", "creado_en"],
      "$orderId": {
        ".indexOn": ["estado", "creado_en"]
      }
    }
  }
}
```

### 2. Conexiones por Tenant

```javascript
// Limitar conexiones simultáneas por restaurante
const MAX_CONNECTIONS_PER_TENANT = 50;
const connections = new Map();

function canConnect(tenant) {
  const count = connections.get(tenant) || 0;
  return count < MAX_CONNECTIONS_PER_TENANT;
}
```

### 3. Cache de Configuración

```javascript
// Cache de configuración por 5 minutos
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getConfig(tenant) {
  const cached = configCache.get(tenant);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const config = await fetchConfigFromFirebase(tenant);
  configCache.set(tenant, { data: config, timestamp: Date.now() });
  return config;
}
```

## Monitoreo

### Métricas Importantes

1. **Órdenes por minuto**: Alertar si > 100/min
2. **Tiempo de respuesta**: Mantener < 200ms
3. **Errores de escritura**: Alertar si > 5%
4. **Conexiones activas**: Monitorear usage

### Firebase Performance Monitoring

```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-performance-compat.js"></script>
<script>
  const perf = firebase.performance();
</script>
```

## Checklist de Seguridad

- [ ] Reglas de Firebase configuradas
- [ ] Rate limiting habilitado (client + server)
- [ ] Validación de inputs en cliente y servidor
- [ ] App Check habilitado (opcional)
- [ ] Monitoreo de métricas activo
- [ ] Backup automático habilitado
- [ ] Uso de HTTPS forzado
- [ ] Headers de seguridad configurados