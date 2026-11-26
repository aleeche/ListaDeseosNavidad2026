// Cuenta regresiva en vivo hasta la medianoche de Nochebuena, en hojas tipo calendario
// (días, horas, minutos y segundos).
//
// Última semana (18–24 de diciembre): sobre las hojas cuelga una guirnalda de 7 focos y cada
// día se enciende uno más (los apagados son los días completos que faltan); el del día palpita
// y en Nochebuena la luz recorre todos. La nieve del encabezado también se espesa (alCambiarNivel).
//
// Medianoche: las hojas en 00 dan una vuelta completa una tras otra, cae la hoja
// «¡Feliz Navidad!», Santa cruza el cielo soltando regalos y la guirnalda del marco celebra.
// Si nadie estaba mirando, se celebra la primera vez que se abre la app en Navidad (una vez por
// dispositivo y año); tocar la hoja de «¡Feliz Navidad!» lo repite.

import { almacen, icono, tiempoParaNavidad } from './util.js';
import { arteTrineo } from './trineo.js';

const dos = (n) => String(n).padStart(2, '0');

const UNIDADES = [
  ['dias', 'día', 'días'],
  ['horas', 'hora', 'horas'],
  ['minutos', 'min', 'min'],
  ['segundos', 'seg', 'seg'],
];

const COLORES_FOCO = ['oro', 'rojo', 'crema', 'oro', 'rojo', 'crema', 'oro'];
const GIRO_MS = 1300; // lo que tardan en girar las 4 hojas en 00 (ver .girando en el CSS)
const FIESTA_MS = 6000; // luces del marco celebrando
const VUELO_MS = 4800; // Santa cruzando el cielo

const reducirMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const claveFiesta = () => `ldn.navidad.${new Date().getFullYear()}`;

/** Corre `fn` cuando ya terminó la intro y la pestaña está a la vista (para que alguien lo vea). */
function cuandoSeVea(fn) {
  if (document.getElementById('intro')) {
    document.addEventListener('ldn:intro-fin', () => cuandoSeVea(fn), { once: true });
  } else if (document.hidden) {
    const alVolver = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', alVolver);
      fn();
    };
    document.addEventListener('visibilitychange', alVolver);
  } else {
    fn();
  }
}

/** Un foco de la guirnalda (mismo dibujo que las luces del marco; el resplandor es #resplandor). */
const foco = (color, i, encendido, deHoy) => `
  <svg class="foco foco-${color}${encendido ? ' encendido' : ''}${deHoy ? ' de-hoy' : ''}" style="--i:${i}"
       viewBox="-10 -1 20 24" aria-hidden="true" focusable="false">
    <circle class="foco-halo" cy="11" r="8.5" filter="url(#resplandor)"/>
    <rect x="-2.6" width="5.2" height="5" rx="1" fill="#ece4d1"/>
    <ellipse class="foco-vidrio" cy="11" rx="4.3" ry="6.4"/>
    <ellipse cx="-1.3" cy="9" rx="1.2" ry="2.3" fill="#fff" opacity=".5"/>
  </svg>`;

function guirnalda(nivel) {
  if (!nivel) return '';
  const todas = nivel >= 7;
  const ayuda = todas ? 'Todas las luces encendidas' : `Una luz por día: ${nivel} de 7 encendidas`;
  return `
    <div class="cuenta-luces${todas ? ' todas' : ''}" title="${ayuda}">
      <svg class="cuenta-cordon" viewBox="0 0 600 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 1Q50 12 100 1Q150 12 200 1Q250 12 300 1Q350 12 400 1Q450 12 500 1Q550 12 600 1"/>
      </svg>
      ${COLORES_FOCO.map((c, i) => foco(c, i, i < nivel, !todas && i === nivel - 1)).join('')}
    </div>`;
}

export function iniciarCuenta(elemento, { alCambiarNivel } = {}) {
  let faseActual = null;
  let nivelActual = null;
  let celebrando = false;

  /** Arma el contenido. `medianoche`: hojas en 00 a punto de girar; `llega`: la hoja de Navidad cae. */
  function armar(fase, nivel, { medianoche = false, llega = false } = {}) {
    faseActual = fase;
    if (nivel !== nivelActual) alCambiarNivel?.(nivel);
    nivelActual = nivel;

    if (fase === 'navidad') {
      elemento.innerHTML = `
        <p class="cuenta-titulo">${icono('tree-pine')} 25 de diciembre</p>
        ${guirnalda(nivel)}
        <div class="cuenta-hojas${llega ? ' llega' : ''}">
          <button type="button" class="hoja hoja-ancha hoja-boton" data-accion="celebrar"
                  title="Toca para celebrar otra vez">
            <span class="hoja-unidad">Ya llegó</span><b class="hoja-numero">¡Feliz Navidad!</b>
          </button>
        </div>`;
      return;
    }

    let titulo = `${icono('hourglass')} Faltan para Navidad`;
    if (medianoche) titulo = `${icono('sparkles')} ¡Llegó la medianoche!`;
    else if (fase === 'nochebuena') titulo = `${icono('sparkles')} ¡Hoy es Nochebuena!`;
    else if (nivel) titulo = `${icono('sparkles')} ¡Última semana para Navidad!`;

    // Las cuatro hojas siempre (el 24 la de días queda en 00).
    elemento.innerHTML = `
      <p class="cuenta-titulo">${titulo}</p>
      ${guirnalda(nivel)}
      <div class="cuenta-hojas">
        ${UNIDADES.map(([clave]) => `
          <div class="hoja" data-unidad="${clave}"><span class="hoja-unidad"></span><b class="hoja-numero"></b></div>`).join('')}
      </div>`;
  }

  function llenar(t) {
    for (const [clave, uno, varios] of UNIDADES) {
      const hoja = elemento.querySelector(`[data-unidad="${clave}"]`);
      if (!hoja) continue;
      const n = t[clave];
      hoja.querySelector('.hoja-numero').textContent = dos(n);
      hoja.querySelector('.hoja-unidad').textContent = n === 1 ? uno : varios;
    }
  }

  /** Santa cruza el cielo del encabezado soltando regalos (detrás del título). */
  function santaEnElCielo() {
    const cielo = elemento.closest('.hero');
    if (!cielo) return;
    cielo.querySelector('.santa-cielo')?.remove();
    cielo.insertAdjacentHTML('beforeend', `
      <div class="trineo santa-cielo" aria-hidden="true" style="--duracion:${VUELO_MS}ms;--desfase:0ms">
        <div class="trineo-viaje">${arteTrineo({ regalos: true })}</div>
      </div>`);
    const capa = cielo.lastElementChild;
    capa.addEventListener('animationend', (e) => {
      if (e.animationName === 'trineo-cruza') capa.remove();
    });
  }

  function celebrar() {
    if (celebrando) return;
    almacen.guardar(claveFiesta(), '1');
    if (reducirMovimiento()) {
      armar('navidad', 7);
      return;
    }
    celebrando = true;
    armar('nochebuena', 7, { medianoche: true });
    llenar({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
    elemento.classList.add('girando');
    santaEnElCielo();
    document.body.classList.add('fiesta');
    setTimeout(() => {
      elemento.classList.remove('girando');
      armar('navidad', 7, { llega: true });
      celebrando = false;
    }, GIRO_MS);
    clearTimeout(celebrar.fiesta);
    celebrar.fiesta = setTimeout(() => document.body.classList.remove('fiesta'), FIESTA_MS);
  }

  function pintar() {
    if (celebrando) return;
    const t = tiempoParaNavidad();
    if (t.fase === 'navidad' && faseActual !== 'navidad') {
      // Medianoche en vivo, o la primera vez que se abre en Navidad: se celebra una vez.
      armar('navidad', t.nivel);
      if (!almacen.leer(claveFiesta())) cuandoSeVea(celebrar);
      return;
    }
    if (t.fase !== faseActual || t.nivel !== nivelActual) armar(t.fase, t.nivel);
    if (t.fase !== 'navidad') llenar(t);
  }

  // Se alinea con el cambio de segundo del reloj para no saltarse números.
  function programar() {
    setTimeout(() => {
      pintar();
      programar();
    }, 1000 - (Date.now() % 1000) + 15);
  }

  pintar();
  programar();
  return { celebrar };
}
