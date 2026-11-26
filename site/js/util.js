// Utilidades compartidas: escape de HTML, enlaces, códigos y fechas.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo de forma segura dentro de HTML. */
export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** Ícono de Lucide del sprite de index.html (decorativo: el texto de al lado da el significado). */
export const icono = (nombre, clase = '') =>
  `<svg class="icono${clase ? ` ${clase}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${nombre}"></use></svg>`;

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

/**
 * Cuánto falta para la medianoche del 24 al 25 de diciembre (hora local).
 * fase: 'falta' | 'nochebuena' (todo el 24) | 'navidad' (del 25 al 31: ya no se cuenta).
 * nivel: 0 hasta el 17; en la última semana sube un punto por día (18 → 1 … 24 → 7) y
 * sigue en 7 en Navidad. La guirnalda del contador enciende un foco por punto.
 */
export function tiempoParaNavidad(ahora = new Date()) {
  const mes = ahora.getMonth();
  const dia = ahora.getDate();
  const nivel = mes === 11 && dia >= 18 ? Math.min(dia - 17, 7) : 0;
  if (mes === 11 && dia >= 25) return { fase: 'navidad', nivel };
  const navidad = new Date(ahora.getFullYear(), 11, 25);
  const total = Math.max(0, Math.floor((navidad - ahora) / 1000));
  return {
    fase: mes === 11 && dia === 24 ? 'nochebuena' : 'falta',
    nivel,
    dias: Math.floor(total / 86_400),
    horas: Math.floor(total / 3600) % 24,
    minutos: Math.floor(total / 60) % 60,
    segundos: total % 60,
  };
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
