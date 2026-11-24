// Utilidades compartidas: escape de HTML, enlaces, códigos y fechas.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo de forma segura dentro de HTML. */
export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/**
 * Normaliza un enlace escrito por el usuario.
 * Devuelve '' si está vacío, null si no es un enlace http(s) válido.
 */
export function normalizarEnlace(texto) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return '';
  const conProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(limpio) ? limpio : `https://${limpio}`;
  try {
    const url = new URL(conProtocolo);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** "https://www.amazon.com/algo" → "amazon.com" */
export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function generarId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// Sin letras/números que se confunden (i, l, o, 0, 1).
const ALFABETO_CODIGO = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Código familiar aleatorio, p. ej. "k7tq-mw3x-p9rd" (~59 bits de azar). */
export function generarCodigoFamilia() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** Acepta el código suelto o el enlace de invitación completo. */
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? '').trim();
  try {
    const desdeEnlace = new URL(limpio).searchParams.get('familia');
    if (desdeEnlace) return desdeEnlace.trim().toLowerCase();
  } catch {
    // No era un enlace: se usa como código tal cual.
  }
  return limpio.toLowerCase();
}

/** Debe coincidir con la validación de firestore.rules. */
export const codigoFamiliaValido = (codigo) => /^[a-z0-9-]{12,64}$/.test(codigo ?? '');

export function cuentaRegresiva(hoy = new Date()) {
  const mes = hoy.getMonth();
  const dia = hoy.getDate();
  if (mes === 11 && dia === 24) return '🌟 ¡Hoy es Nochebuena!';
  if (mes === 11 && dia >= 25) return '🎄 ¡Feliz Navidad!';
  const inicioHoy = new Date(hoy.getFullYear(), mes, dia);
  const navidad = new Date(hoy.getFullYear(), 11, 25);
  const dias = Math.round((navidad - inicioHoy) / 86_400_000);
  return `⏳ Faltan ${dias} días para Navidad`;
}

/** Color estable (0–5) para el avatar de cada integrante. */
export function tono(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 6;
}

/** localStorage puede fallar (modo privado, bloqueos): nunca debe romper la app. */
export const almacen = {
  leer(clave) {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  guardar(clave, valor) {
    try {
      if (valor == null) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    } catch {
      // Sin almacenamiento disponible: la app sigue funcionando en memoria.
    }
  },
};

/** Error con código, para distinguir casos esperados (p. ej. regalo ya apartado). */
export function errorConCodigo(codigo, mensaje) {
  return Object.assign(new Error(mensaje), { code: codigo });
}
