#!/usr/bin/env node
/**
 * 🖨️ AUTO-PRINT SERVER — Rogasa Delivery
 * 
 * Escucha nuevos pedidos en Firebase Realtime Database y los imprime
 * automáticamente en la impresora térmica del restaurante.
 * 
 * REQUISITOS:
 *   1. Node.js 18+
 *   2. npm install firebase-admin
 *   3. Un archivo de credenciales Firebase (ver INSTRUCCIONES abajo)
 *   4. Una impresora térmica conectada y configurada como predeterminada
 * 
 * USO:
 *   node scripts/auto-print-server.js [--tenant rogasa] [--dry-run]
 * 
 * Opciones:
 *   --tenant <nombre>   Filtrar pedidos de un restaurante específico (default: todos)
 *   --dry-run           Solo mostrar el recibo en consola, no imprimir
 *   --no-sound          No reproducir sonido de alerta
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 *   1. cd /ruta/al/proyecto
 *   2. npm install firebase-admin
 *   3. Colocar el archivo de service account JSON en scripts/firebase-service-account.json
 *      (Lo puedes descargar de: Firebase Console → Configuración → Cuentas de servicio)
 *   4. Conectar la impresora térmica (USB o red)
 *   5. En macOS: Configurar la impresora como predeterminada en System Preferences
 *      En Windows: Configurar como impresora predeterminada
 *   6. Ejecutar: node scripts/auto-print-server.js
 * 
 * Para ejecutar en segundo plano (macOS):
 *   launchctl submit -l com.rogasa.auto-print -- /usr/local/bin/node /ruta/proyecto/scripts/auto-print-server.js
 * 
 * Para ejecutar en segundo plano (Linux):
 *   nohup node scripts/auto-print-server.js > /var/log/auto-print.log 2>&1 &
 */

const admin = require('firebase-admin');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── CONFIGURACIÓN ────────────────────────────────────────────────
const FIREBASE_DB_URL = 'https://rogasa-delivery-default-rtdb.firebaseio.com';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');
const TASA_DEFAULT = 45; // tasa de cambio por defecto si no viene en el pedido

// Parseo de argumentos
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_SOUND = args.includes('--no-sound');
const tenantIdx = args.indexOf('--tenant');
const TENANT_FILTER = tenantIdx >= 0 ? args[tenantIdx + 1] : null;

// ─── INICIALIZAR FIREBASE ─────────────────────────────────────────
function initFirebase() {
  if (admin.apps.length > 0) return;
  
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ No se encontró el archivo de credenciales Firebase:');
    console.error(`   ${SERVICE_ACCOUNT_PATH}`);
    console.error('');
    console.error('   Descárgalo de: Firebase Console → Configuración del proyecto');
    console.error('   → Pestaña "Cuentas de servicio" → "Generar nueva clave privada"');
    console.error('');
    console.error('   Guía rápida:');
    console.error('   1. Ve a https://console.firebase.google.com');
    console.error('   2. Selecciona tu proyecto (rogasa-delivery)');
    console.error('   3. Rueda de configuración → Cuentas de servicio');
    console.error('   4. Haz clic en "Generar nueva clave privada"');
    console.error('   5. Guarda el archivo como: scripts/firebase-service-account.json');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential(require(SERVICE_ACCOUNT_PATH)),
    databaseURL: FIREBASE_DB_URL,
  });
  console.log('✅ Firebase conectado');
}

// ─── GENERAR RECIBO ───────────────────────────────────────────────
function generateReceipt(order, restaurantConfig) {
  const name = (restaurantConfig?.nombre || 'RESTAURANTE').toUpperCase();
  const addr = restaurantConfig?.direccion || '';
  const phone = restaurantConfig?.telefono || '';
  const tasa = restaurantConfig?.tasa || TASA_DEFAULT;
  
  const time = new Date(order.creado_en || order.creado_el || Date.now())
    .toLocaleString('es-VE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

  const totalBs = order.total_bs || ((order.total_usd || 0) * tasa);

  let r = '';
  r += `${'═'.repeat(32)}\n`;
  r += `${center(name, 32)}\n`;
  r += `${center(addr, 32)}\n`;
  if (phone) r += `${center(phone, 32)}\n`;
  r += `${'═'.repeat(32)}\n`;
  r += `PEDIDO: ${order.id}\n`;
  r += `FECHA:  ${time}\n`;
  r += `${'─'.repeat(32)}\n`;
  r += `CLIENTE: ${order.cliente_nombre || ''}\n`;
  r += `TEL:     ${order.telefono || ''}\n`;
  r += `DIR:     ${order.ubicacion || ''}\n`;
  r += `${'─'.repeat(32)}\n`;
  r += `DETALLE:\n`;
  (order.items || []).forEach(item => {
    const qty = item.cantidad || item.q || 1;
    const itemName = item.nombre || item.name || '';
    r += `  ${qty}x ${itemName}\n`;
  });
  r += `${'─'.repeat(32)}\n`;
  r += `PAGO: ${(order.metodo_pago || '').toUpperCase()}\n`;
  r += `TOTAL: $${(order.total_usd || 0).toFixed(2)} / Bs. ${totalBs.toFixed(2)}\n`;
  r += `${'═'.repeat(32)}\n`;
  r += `${center('¡Gracias!', 32)}\n`;
  r += `${'═'.repeat(32)}\n`;
  return r;
}

function center(str, width) {
  if (str.length >= width) return str.slice(0, width);
  const pad = Math.floor((width - str.length) / 2);
  return ' '.repeat(pad) + str;
}

// ─── IMPRIMIR ─────────────────────────────────────────────────────
function printReceipt(text, orderId) {
  if (DRY_RUN) {
    console.log('\n' + '═'.repeat(40));
    console.log(`📋 RECIBO (DRY RUN) — Pedido ${orderId}`);
    console.log('═'.repeat(40));
    console.log(text);
    console.log('═'.repeat(40) + '\n');
    return;
  }

  // Crear archivo temporal e imprimir
  const tmpFile = `/tmp/receipt_${orderId}.txt`;
  fs.writeFileSync(tmpFile, text, 'utf-8');

  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      // macOS: usar lpr
      execSync(`lpr "${tmpFile}"`, { timeout: 10000 });
      console.log(`🖨️  Pedido ${orderId} enviado a la impresora`);
    } else if (platform === 'linux') {
      // Linux: usar lp
      execSync(`lp "${tmpFile}"`, { timeout: 10000 });
      console.log(`🖨️  Pedido ${orderId} enviado a la impresora`);
    } else if (platform === 'win32') {
      // Windows: usar notepad como fallback (el usuario puede configurar otra cosa)
      execSync(`print "${tmpFile}"`, { timeout: 10000 });
      console.log(`🖨️  Pedido ${orderId} enviado a la impresora`);
    } else {
      console.log(`⚠️  Plataforma no soportada para impresión: ${platform}`);
      console.log('   Contenido del recibo:');
      console.log(text);
    }
  } catch (err) {
    console.error(`❌ Error al imprimir pedido ${orderId}:`, err.message);
    console.log('   Contenido del recibo:');
    console.log(text);
  } finally {
    // Limpiar archivo temporal
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

// ─── SONIDO DE ALERTA ─────────────────────────────────────────────
function playAlertSound() {
  if (NO_SOUND) return;
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      execSync('afplay /System/Library/Sounds/Glass.aiff &', { timeout: 2000 });
    } else if (platform === 'linux') {
      execSync('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null &', { timeout: 2000 });
    }
  } catch (e) {
    // Silenciar errores de sonido
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('🖨️  AUTO-PRINT SERVER — Rogasa Delivery');
  console.log('─'.repeat(40));
  if (TENANT_FILTER) console.log(`   Restaurante: ${TENANT_FILTER}`);
  if (DRY_RUN) console.log('   Modo: DRY RUN (solo imprime en consola)');
  console.log('');
  
  initFirebase();
  const db = admin.database();
  
  // Cachear configuraciones de restaurantes
  const configCache = {};
  
  async function getRestaurantConfig(restaurante) {
    if (configCache[restaurante]) return configCache[restaurante];
    try {
      const snap = await db.ref(`restaurantes/${restaurante}/config`).get();
      if (snap.exists()) {
        configCache[restaurante] = snap.val();
        return configCache[restaurante];
      }
    } catch (e) {}
    configCache[restaurante] = { nombre: restaurante };
    return configCache[restaurante];
  }

  // IDs de pedidos ya impresos (para no duplicar)
  const printedIds = new Set();

  // Escuchar cambios en /orders
  const ordersRef = db.ref('orders');
  
  // Usar child_added para detectar nuevos pedidos
  ordersRef.on('child_added', async (snapshot) => {
    const order = snapshot.val();
    if (!order || !order.id) return;
    
    // Ya se imprimió?
    if (printedIds.has(order.id)) return;
    printedIds.add(order.id);
    
    // Filtrar por tenant si se especificó
    const orderTenant = order.restaurante || 'rogasa';
    if (TENANT_FILTER && orderTenant !== TENANT_FILTER) return;
    
    // No imprimir entregados
    if (order.estado === 'entregado') return;
    
    const config = await getRestaurantConfig(orderTenant);
    const receipt = generateReceipt(order, config);
    
    console.log(`\n📦 NUEVO PEDIDO: ${order.id} (${order.cliente_nombre || 'Sin nombre'})`);
    playAlertSound();
    printReceipt(receipt, order.id);
  });

  console.log('👁️  Escuchando nuevos pedidos...');
  console.log('   Presiona Ctrl+C para detener\n');
  
  // Manejar cierre limpio
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo auto-print server...');
    db.goOffline();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    db.goOffline();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
