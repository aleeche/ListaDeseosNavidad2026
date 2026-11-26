// Animación de «Yo lo regalo»: Santa cruza la tarjeta del regalo en su trineo, de izquierda a
// derecha, con dos renos al galope y una estela de destellos. Dibujo propio en SVG en línea
// (no con <use>) para que las patas, el vaivén y los destellos se animen con CSS.
//
// Cada snapshot vuelve a pintar toda la lista, así que la animación no se reinicia: app.js
// pasa cuánto lleva el viaje y el CSS lo usa como retraso negativo (--desfase).
// El mismo dibujo, con regalos que caen, cruza el cielo a medianoche de Navidad (cuenta.js).

export const DURACION_TRINEO = 3200; // ms; el CSS lo recibe en --duracion

const COLOR = {
  trineo: '#b52d24',
  trineoBorde: '#7a160f',
  oro: '#f2b632',
  oroOscuro: '#c98d16',
  abrigo: '#e0453a',
  manga: '#c93a30',
  piel: '#f3c7a5',
  pelo: '#f6efe0',
  negro: '#2b1d16',
  reno: '#b8794a',
  renoPatas: '#96603a',
  renoSombra: '#7d4b29',
  renoClaro: '#dcb98c',
  cuernos: '#ead8b4',
  cuernosSombra: '#c9b48c',
};

/** Destello de cuatro puntas de la estela. */
const destello = (x, y, escala, opacidad, i) => `
  <g transform="translate(${x} ${y}) scale(${escala})" opacity="${opacidad}">
    <path class="trineo-destello" style="--i:${i}" d="M0-4Q.6-.6 4 0Q.6 .6 0 4Q-.6 .6-4 0Q-.6-.6 0-4Z" fill="#ffd36e"/>
  </g>`;

/** Un reno de perfil mirando a la derecha (dibujado a escala 1.2); (x, y) es su esquina superior izquierda aproximada. */
function reno(x, y, fase, nariz) {
  const patas = (trazos) => trazos
    .map(([d, color]) => `<path d="${d}" stroke="${color}"/>`).join('');
  const pezunas = (puntos) => puntos
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="1.4" fill="${COLOR.negro}"/>`).join('');
  return `
  <g transform="translate(${x} ${y}) scale(1.2)">
    <g class="trineo-reno" style="--fase:${fase}">
      <g class="trineo-patas trineo-patas-atras" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        ${patas([['M14 25 7 32 1 35.5', COLOR.renoSombra], ['M11 25 4 30.5-2.5 31', COLOR.renoPatas]])}
        ${pezunas([[1, 35.5], [-2.5, 31]])}
      </g>
      <g class="trineo-patas trineo-patas-adelante" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        ${patas([['M29 25 36 31 42 32.5', COLOR.renoSombra], ['M32 24 41 27.5 47 25', COLOR.renoPatas]])}
        ${pezunas([[42, 32.5], [47, 25]])}
      </g>
      <ellipse cx="6.5" cy="19.5" rx="3.2" ry="1.8" transform="rotate(-28 6.5 19.5)" fill="${COLOR.pelo}"/>
      <ellipse cx="22" cy="22" rx="15" ry="7.5" transform="rotate(-8 22 22)" fill="${COLOR.reno}"/>
      <ellipse cx="22" cy="26.4" rx="10" ry="2.4" transform="rotate(-8 22 26.4)" fill="${COLOR.renoClaro}"/>
      <path d="M30 19C32 12 37 7 41 4L46 7C42 11 39 17 37 23Z" fill="${COLOR.reno}"/>
      <path d="M45.5 2C47-2 46-6 42.5-9.5M46.2-3 50-5.5" fill="none" stroke="${COLOR.cuernosSombra}" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="45" cy="5.5" rx="5.5" ry="4" transform="rotate(18 45 5.5)" fill="${COLOR.reno}"/>
      <ellipse cx="50.5" cy="8" rx="3.4" ry="2.5" transform="rotate(22 50.5 8)" fill="${COLOR.renoClaro}"/>
      <circle cx="53.4" cy="9.3" r="${nariz ? 1.9 : 1.4}" fill="${nariz ? '#ff4a3d' : COLOR.negro}"/>
      <circle cx="46" cy="4.2" r=".8" fill="${COLOR.negro}"/>
      <path d="M41.5 3Q37 .5 36 2.6 38.5 4.8 41.8 4.6Z" fill="${COLOR.renoSombra}"/>
      <path d="M43 2C41.5-3 38-6 33.5-7.5M40.6-3.2 42.6-7.8M37.4-5.6 37-10" fill="none" stroke="${COLOR.cuernos}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M31 16Q35 21 35.5 26" fill="none" stroke="#c8352a" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="35.6" cy="26.8" r="1.8" fill="${COLOR.oro}"/>
    </g>
  </g>`;
}

const SANTA = `
  <g transform="rotate(-10 21 12)">
    <rect x="13" y="4" width="16" height="15" rx="1.5" fill="${COLOR.oro}" stroke="${COLOR.oroOscuro}" stroke-width=".8"/>
    <path d="M21 4v15M13 11.5h16" stroke="#c8352a" stroke-width="2.4"/>
    <path d="M21 4C17 .5 13.5 2.5 17 4.6ZM21 4C25 .5 28.5 2.5 25 4.6Z" fill="#c8352a"/>
  </g>
  <g transform="rotate(8 31 18)">
    <rect x="25" y="12" width="12" height="12" rx="1.2" fill="#f3ecdc" stroke="#cfc4a8" stroke-width=".8"/>
    <path d="M31 12v12M25 18h12" stroke="#c8352a" stroke-width="2"/>
  </g>
  <path d="M33 46C31 33 35 22 45 20 55 18 62 24 63 34L64 46Z" fill="${COLOR.abrigo}"/>
  <path d="M32.6 38H63.6L63.8 42H32.4Z" fill="${COLOR.negro}"/>
  <rect x="53" y="37.2" width="5.5" height="5.6" rx=".8" fill="none" stroke="${COLOR.oro}" stroke-width="1.3"/>
  <path d="M47 25Q57 33 67 31" fill="none" stroke="${COLOR.manga}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="67.5" cy="30.8" r="3.2" fill="${COLOR.pelo}"/>
  <circle cx="71.2" cy="30.4" r="2.9" fill="${COLOR.negro}"/>
  <circle cx="55" cy="13" r="6.2" fill="${COLOR.piel}"/>
  <circle cx="57" cy="14" r="1.7" fill="#f09a86" opacity=".7"/>
  <path d="M50 14C48 22 52 30 59 30 65 29 66 22 63.5 15 61 18 57 19 54 17Z" fill="${COLOR.pelo}"/>
  <ellipse cx="60" cy="16.4" rx="3.6" ry="1.7" fill="#fffaf0"/>
  <circle cx="61.6" cy="14.2" r="1.6" fill="#e8907a"/>
  <circle cx="58.2" cy="11.6" r=".85" fill="${COLOR.negro}"/>
  <path d="M49.5 9C48 4 51 .8 55 .3 59-.2 63 2.5 63.8 8.5ZM53 1.4C46-.5 39 1.5 34.5 6.8 40 6.2 46 7.4 50 9Z" fill="${COLOR.abrigo}"/>
  <circle cx="34.5" cy="7" r="2.8" fill="${COLOR.pelo}"/>
  <rect x="47.5" y="7.6" width="17.5" height="4.4" rx="2.2" transform="rotate(4 56 9.8)" fill="${COLOR.pelo}"/>`;

const TRINEO = `
  <path d="M28 57v9M72 56v10" stroke="${COLOR.oroOscuro}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M6 63Q6 67 11 67H86C95 67 101 62 101 56 101 52 97 51 95.5 54" fill="none" stroke="${COLOR.oro}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  ${SANTA}
  <path d="M12 22C12 17 22 16 24 21L26 40Q27 44 32 44H64C76 44 84 36 90 26Q93 22 97 24 100 27 96 31C92 40 86 56 70 58H20Q10 58 9 48Z" fill="${COLOR.trineo}" stroke="${COLOR.trineoBorde}" stroke-linejoin="round"/>
  <path d="M24 21 26 40Q27 44 32 44H64C76 44 84 36 90 26Q93 22 97 24" fill="none" stroke="${COLOR.oro}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M34 51C38 47 44 47 46 51S54 55 58 51" fill="none" stroke="${COLOR.oro}" stroke-width="1.4" stroke-linecap="round"/>`;

/** Regalo que Santa suelta desde la parte de atrás del trineo (solo en el vuelo de medianoche). */
const regaloQueCae = ([caja, cinta], i) => `
  <g transform="translate(${20 + (i % 2) * 9} 14)">
    <g class="trineo-regalo-cae" style="--d:${(0.9 + i * 0.55).toFixed(2)}s">
      <rect x="-7" y="-7" width="14" height="14" rx="1.5" fill="${caja}"/>
      <path d="M0-7v14M-7 0h14" stroke="${cinta}" stroke-width="2.6"/>
      <path d="M0-7C-3-11-7-9-4-7ZM0-7C3-11 7-9 4-7Z" fill="${cinta}"/>
    </g>
  </g>`;

const REGALOS = [
  [COLOR.oro, '#c8352a'],
  ['#f3ecdc', '#c8352a'],
  ['#c8352a', COLOR.oro],
  [COLOR.oro, '#2f8a43'],
  ['#f3ecdc', '#2f8a43'],
];

const arte = (regalos) => `
  <svg class="trineo-arte" viewBox="-64 -8 306 80" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="trineo-estela" x1="0" x2="1">
        <stop offset="0" stop-color="#ffd36e" stop-opacity="0"/>
        <stop offset="1" stop-color="#ffd36e" stop-opacity=".8"/>
      </linearGradient>
    </defs>
    <g class="trineo-vuelo">
      <path d="M-62 57Q-28 67 10 64" fill="none" stroke="url(#trineo-estela)" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M-46 48Q-18 57 8 58" fill="none" stroke="url(#trineo-estela)" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
      ${destello(-4, 57, 1.35, 1, 0)}
      ${destello(-15, 66, 1, 0.9, 1)}
      ${destello(-25, 51, 0.85, 0.85, 2)}
      ${destello(-35, 61, 0.95, 0.7, 3)}
      ${destello(-45, 54, 0.65, 0.55, 4)}
      ${destello(-55, 63, 0.7, 0.45, 5)}
      ${destello(-62, 52, 0.5, 0.35, 6)}
      ${regalos ? REGALOS.map(regaloQueCae).join('') : ''}
      ${TRINEO}
      <path d="M72 30.5Q107 47 146.7 46.2Q180 46 214.7 38.2" fill="none" stroke="${COLOR.oro}" stroke-width="1.1" stroke-linecap="round"/>
      ${reno(104, 14, '0s', false)}
      ${reno(172, 6, '-.25s', true)}
    </g>
  </svg>`;

const ARTE = arte(false);

/** El dibujo solo; con `regalos`, Santa va soltando cajas que caen (vuelo de medianoche, cuenta.js). */
export const arteTrineo = ({ regalos = false } = {}) => (regalos ? arte(true) : ARTE);

/**
 * Capas del viaje; `transcurrido` = ms que ya lleva. La pintura (bajo el texto) va dejando la
 * tarjeta dorada detrás del trineo; el trineo (sobre el texto) la cruza. La tarjeta lleva la
 * clase .en-vuelo mientras tanto.
 */
export function trineo(transcurrido) {
  const tiempo = `--duracion:${DURACION_TRINEO}ms;--desfase:${-Math.round(transcurrido)}ms`;
  return `<div class="trineo-pintura" aria-hidden="true" style="${tiempo}"></div>
  <div class="trineo" aria-hidden="true" style="${tiempo}">
    <div class="trineo-viaje">${ARTE}</div>
  </div>`;
}
