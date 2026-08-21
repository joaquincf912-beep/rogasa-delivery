/**
 * Security & Scalability Module
 * Protección contra abuso, rate limiting, validación de datos
 * y optimización para alto volumen de pedidos
 */

const Security = (() => {
  'use strict';

  // === RATE LIMITING ===
  const RATE_LIMITS = {
    orders: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 pedidos cada 15 minutos
    adminActions: { max: 30, windowMs: 60 * 1000 }, // 30 acciones admin por minuto
    search: { max: 20, windowMs: 60 * 1000 }, // 20 búsquedas por minuto
  };

  const rateLimitStore = new Map();

  function checkRateLimit(action) {
    const limit = RATE_LIMITS[action];
    if (!limit) return true;

    const now = Date.now();
    const key = `${action}_${now}`;
    
    if (!rateLimitStore.has(action)) {
      rateLimitStore.set(action, []);
    }

    const timestamps = rateLimitStore.get(action);
    const windowStart = now - limit.windowMs;
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(t => t > windowStart);
    rateLimitStore.set(action, validTimestamps);

    if (validTimestamps.length >= limit.max) {
      const retryAfter = Math.ceil((validTimestamps[0] + limit.windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    validTimestamps.push(now);
    return { allowed: true, remaining: limit.max - validTimestamps.length };
  }

  // === INPUT VALIDATION ===
  function sanitizeInput(input, maxLength = 500) {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '') // Basic XSS prevention
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  function validatePhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^[0-9]{10,15}$/.test(cleaned);
  }

  function validateName(name) {
    return name && name.length >= 2 && name.length <= 100;
  }

  function validateOrder(order) {
    const errors = [];

    if (!validateName(order.cliente_nombre)) {
      errors.push('Nombre inválido (2-100 caracteres)');
    }

    if (!validatePhone(order.telefono)) {
      errors.push('Teléfono inválido (10-15 dígitos)');
    }

    if (!order.ubicacion || order.ubicacion.length < 5) {
      errors.push('Dirección muy corta');
    }

    if (!order.items || order.items.length === 0) {
      errors.push('El pedido debe tener al menos un plato');
    }

    if (order.items && order.items.length > 20) {
      errors.push('Máximo 20 platos por pedido');
    }

    if (order.total_usd <= 0 || order.total_usd > 1000) {
      errors.push('Total inválido');
    }

    return { valid: errors.length === 0, errors };
  }

  // === ORDER FLOOD PROTECTION ===
  const recentOrders = new Map(); // ip/orderId -> timestamp

  function checkOrderFlood(identifier) {
    const now = Date.now();
    const lastOrder = recentOrders.get(identifier);
    
    if (lastOrder && (now - lastOrder) < 30000) { // 30 segundos entre pedidos
      return { allowed: false, waitSeconds: Math.ceil((30000 - (now - lastOrder)) / 1000) };
    }

    recentOrders.set(identifier, now);
    
    // Clean old entries every 100 checks
    if (recentOrders.size > 100) {
      const cutoff = now - 300000; // 5 minutes
      for (const [key, timestamp] of recentOrders) {
        if (timestamp < cutoff) recentOrders.delete(key);
      }
    }

    return { allowed: true };
  }

  // === PERFORMANCE OPTIMIZATION ===
  const cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCached(key) {
    const item = cache.get(key);
    if (item && (Date.now() - item.timestamp) < CACHE_TTL) {
      return item.data;
    }
    cache.delete(key);
    return null;
  }

  function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // === CONCURRENT CONNECTION MANAGEMENT ===
  let activeConnections = 0;
  const MAX_CONNECTIONS = 50;

  function canMakeConnection() {
    return activeConnections < MAX_CONNECTIONS;
  }

  function connectionStarted() {
    activeConnections++;
  }

  function connectionEnded() {
    activeConnections = Math.max(0, activeConnections - 1);
  }

  // === ERROR HANDLING WITH RETRY ===
  async function withRetry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  // === SECURITY HEADERS (for reference) ===
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  return {
    checkRateLimit,
    sanitizeInput,
    validatePhone,
    validateName,
    validateOrder,
    checkOrderFlood,
    getCached,
    setCache,
    canMakeConnection,
    connectionStarted,
    connectionEnded,
    withRetry,
    securityHeaders,
  };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Security;
}