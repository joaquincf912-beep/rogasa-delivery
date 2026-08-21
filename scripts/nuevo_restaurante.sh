#!/bin/bash
# ============================================================================
# nuevo_restaurante.sh — Alta rápida de un restaurante nuevo en la plantilla
#
# Crea el nodo /restaurantes/{tenant}/ en Firebase Realtime Database con la
# configuración básica (nombre, WhatsApp, dirección, horario, logo). El menú
# por defecto de la plantilla se usa automáticamente hasta que el restaurante
# edite el suyo desde Admin. Las promos quedan vacías listas para publicar.
#
# Uso:
#   ./scripts/nuevo_restaurante.sh <tenant> "<Nombre>" "<WhatsApp con país>" \
#       ["Dirección"] ["Horario"] ["URL del logo"]
#
# Ejemplo:
#   ./scripts/nuevo_restaurante.sh cafeparis "Café París" "584121234567" \
#       "Av. Las Palmas, Local 2" "Lun-Dom 9am-9pm" "https://mipagina.com/logo.png"
# ============================================================================
set -e

TENANT="$1"
NOMBRE="$2"
WA="$3"
DIR="${4:-}"
HORARIO="${5:-}"
LOGO="${6:-}"

DB="https://rogasa-delivery-default-rtdb.firebaseio.com"

if [ -z "$TENANT" ] || [ -z "$NOMBRE" ] || [ -z "$WA" ]; then
  echo "❌ Faltan datos obligatorios."
  echo ""
  echo "Uso: $0 <tenant> \"Nombre\" \"WhatsApp (código de país incluido)\" [\"Dirección\"] [\"Horario\"] [\"Logo URL\"]"
  echo "Ej:  $0 cafeparis \"Café París\" \"584121234567\" \"Av. Las Palmas\" \"Lun-Dom 9am-9pm\""
  exit 1
fi

# Validar slug del tenant: solo minúsculas, números y guiones
if ! echo "$TENANT" | grep -qE '^[a-z0-9-]+$'; then
  echo "❌ El tenant solo puede tener minúsculas, números y guiones. Ej: cafeparis"
  exit 1
fi

# Validar WhatsApp: dígitos, 7 a 15, con código de país
WA_CLEAN=$(echo "$WA" | tr -d ' ')
if ! echo "$WA_CLEAN" | grep -qE '^[0-9]{7,15}$'; then
  echo "❌ El WhatsApp debe ser solo números con código de país (ej: 584225604660)."
  exit 1
fi

echo "🚀 Creando restaurante: $NOMBRE (tenant: $TENANT) ..."

# Config básica
BODY=$(python3 - "$TENANT" "$NOMBRE" "$WA_CLEAN" "$DIR" "$HORARIO" "$LOGO" <<'PYEOF'
import json, sys
t, nombre, wa, direccion, horario, logo = sys.argv[1:7]
cfg = {
    "nombre": nombre,
    "whatsapp": wa,
    "delivery": 2,
    "direccion": direccion,
    "horario": horario,
    "logo": logo
}
print(json.dumps(cfg, ensure_ascii=False))
PYEOF
)

RESP=$(curl -s -X PUT "$DB/restaurantes/$TENANT/config.json" -H "Content-Type: application/json" -d "$BODY")
echo "$RESP" | python3 -c "import json,sys; json.load(sys.stdin); print('✅ Config guardada.')"

# Promos y menú no se crean: sin datos, la plantilla muestra el menú por
# defecto y oculta la sección de promos hasta que el restaurante publique desde
# Admin (comportamiento intencional del multi-tenant).
echo "✅ Sin promos todavía: la sección aparece cuando publiquen la primera."
echo "✅ Menú por defecto activo (editable desde Admin)."

echo ""
echo "🎉 Restaurante $NOMBRE creado. Links:"
echo "   Local (preview):  http://127.0.0.1:8095/?t=$TENANT"
echo "   Producción:       https://menu.traccionweb.com/delivery/?t=$TENANT"
echo ""
echo "Siguiente paso: abrir Admin (PIN 1234) → Mi Restaurante para ajustar y "
echo "luego Menú / Promociones para publicar sus platos y ofertas."
