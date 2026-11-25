// Cuenta regresiva en vivo hasta la medianoche de Nochebuena, en hojas tipo calendario
// (días, horas, minutos y segundos).

import { icono, tiempoParaNavidad } from './util.js';

const dos = (n) => String(n).padStart(2, '0');

const UNIDADES = [
  ['dias', 'día', 'días'],
  ['horas', 'hora', 'horas'],
  ['minutos', 'min', 'min'],
  ['segundos', 'seg', 'seg'],
];

export function iniciarCuenta(elemento) {
  let faseActual = null;

  function armar(fase) {
    faseActual = fase;
    if (fase === 'navidad') {
      elemento.innerHTML = `
        <p class="cuenta-titulo">${icono('tree-pine')} 25 de diciembre</p>
        <div class="cuenta-hojas"><div class="hoja hoja-ancha">
          <span class="hoja-unidad">Ya llegó</span><b class="hoja-numero">¡Feliz Navidad!</b>
        </div></div>`;
      return;
    }
    // El 24 solo quedan horas: no se muestra la hoja de días.
    const unidades = fase === 'nochebuena' ? UNIDADES.slice(1) : UNIDADES;
    elemento.innerHTML = `
      <p class="cuenta-titulo">${fase === 'nochebuena'
        ? `${icono('sparkles')} ¡Hoy es Nochebuena! Faltan para la medianoche`
        : `${icono('hourglass')} Faltan para Navidad`}</p>
      <div class="cuenta-hojas">
        ${unidades.map(([clave]) => `
          <div class="hoja" data-unidad="${clave}"><span class="hoja-unidad"></span><b class="hoja-numero"></b></div>`).join('')}
      </div>`;
  }

  function pintar() {
    const t = tiempoParaNavidad();
    if (t.fase !== faseActual) armar(t.fase);
    if (t.fase === 'navidad') return;
    for (const [clave, uno, varios] of UNIDADES) {
      const hoja = elemento.querySelector(`[data-unidad="${clave}"]`);
      if (!hoja) continue;
      const n = t[clave];
      hoja.querySelector('.hoja-numero').textContent = clave === 'dias' ? n : dos(n);
      hoja.querySelector('.hoja-unidad').textContent = n === 1 ? uno : varios;
    }
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
}
