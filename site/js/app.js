// Interfaz de la lista de deseos familiar.
// Renderiza con plantillas de texto y maneja los clics con un solo listener
// (atributos data-accion / data-id en los botones).

import {
  almacen,
  codigoFamiliaValido,
  dominio,
  esc,
  generarCodigoFamilia,
  icono,
  normalizarCodigo,
  normalizarEnlace,
  tono,
} from './util.js';
import { iniciarCuenta } from './cuenta.js';
import { iniciarIntro } from './intro.js';
import { iniciarNieve } from './nieve.js';
import { DURACION_TRINEO, trineo } from './trineo.js';

const EMOJIS = ['🎅', '🤶', '🧑‍🎄', '⛄', '🦌', '🧝', '🎄', '⭐', '🍪', '🐧', '🐻', '🦊', '🐱', '🐶', '🦄', '🎁'];
const PRIORIDADES = { 3: '¡Lo que más quiero!', 2: 'Me encantaría', 1: 'Me gustaría' };
const CLAVE_FAMILIA = 'ldn.familia';

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const dialogo = $('#dialogo');

const estado = {
  modo: window.FIREBASE_CONFIG ? 'firebase' : 'local',
  familia: null, // código familiar (en modo demo: "demo")
  yo: null, // id del integrante que usa este dispositivo
  vista: null, // id del integrante cuya lista se ve, o "compras"
  datos: { miembros: [], deseos: [] },
  recienCreada: false,
  trineo: null, // { id, inicio }: deseo que Santa está cruzando tras «Yo lo regalo» (solo en este dispositivo)
  salto: null, // { id, inicio }: compra recién marcada; su check da un saltito
};

const DURACION_SALTO = 600; // ms; .check.salta en el CSS dura un poco menos

let store = null;
let cuenta = null; // { celebrar } de la cuenta regresiva
let borradorDeseo = null; // lo escrito en «Nuevo deseo», para volver a corregirlo desde la confirmación

const claveYo = () => `ldn.yo.${estado.familia}`;

// ---------------------------------------------------------------------------
// Consultas sobre los datos
// ---------------------------------------------------------------------------

const miembrosOrdenados = () =>
  [...estado.datos.miembros].sort((a, b) => (a.creado ?? 0) - (b.creado ?? 0));
const buscarMiembro = (id) => estado.datos.miembros.find((m) => m.id === id);
const buscarDeseo = (id) => estado.datos.deseos.find((d) => d.id === id);
const yoActual = () => buscarMiembro(estado.yo);
const nombreDe = (id) => buscarMiembro(id)?.nombre ?? 'alguien';
const deseosDe = (id) =>
  estado.datos.deseos
    .filter((d) => d.miembroId === id)
    .sort((a, b) => (b.prioridad ?? 2) - (a.prioridad ?? 2) || (a.creado ?? 0) - (b.creado ?? 0));
// Admin: quien creó la familia, es decir, el primer integrante que se agregó.
// Es solo de la interfaz: cualquiera que elija ese nombre en «¿Quién eres?» actúa como admin.
const adminFamilia = () => miembrosOrdenados()[0];
const esAdmin = (miembro) => Boolean(miembro) && adminFamilia()?.id === miembro.id;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const estrellas = (n) =>
  `<span class="estrellas-iconos" aria-hidden="true">${[1, 2, 3]
    .map((i) => icono('star', i <= n ? 'icono-lleno' : 'estrella-vacia')).join('')}</span>`;
/** Milisegundos que lleva el trineo cruzando el deseo `id`, o null si no lo está cruzando. */
const vueloTrineo = (id) => {
  if (estado.trineo?.id !== id) return null;
  const transcurrido = performance.now() - estado.trineo.inicio;
  return transcurrido < DURACION_TRINEO ? transcurrido : null;
};
/** Atributos del check de «Mis compras»: si se acaba de marcar, da un saltito que sigue aunque se repinte. */
const atributosCheck = (id) => {
  if (estado.salto?.id !== id) return 'class="check"';
  const transcurrido = performance.now() - estado.salto.inicio;
  return transcurrido < DURACION_SALTO
    ? `class="check salta" style="--desfase:${-Math.round(transcurrido)}ms"`
    : 'class="check"';
};
const insigniaAdmin = () => `<span class="insignia-admin">${icono('crown')} Admin</span>`;
const botonAyuda = () =>
  `<button class="boton-ayuda" data-accion="ayuda" aria-label="¿Cómo funciona?" title="¿Cómo funciona?">${icono('circle-help')}</button>`;

// ---------------------------------------------------------------------------
// Arranque y conexión
// ---------------------------------------------------------------------------

async function iniciar() {
  iniciarIntro();
  const nieve = iniciarNieve($('#nieve'));
  // En la última semana nieva más cada día (nivel 1–7).
  cuenta = iniciarCuenta($('#cuenta'), { alCambiarNivel: (nivel) => nieve?.intensidad(1 + nivel * 0.2) });

  // El enlace de invitación trae ?familia=codigo: se guarda y se limpia de la URL.
  const params = new URLSearchParams(location.search);
  if (params.has('familia')) {
    const codigo = normalizarCodigo(params.get('familia'));
    if (codigoFamiliaValido(codigo)) almacen.guardar(CLAVE_FAMILIA, codigo);
    params.delete('familia');
    const resto = params.toString();
    history.replaceState(null, '', location.pathname + (resto ? `?${resto}` : '') + location.hash);
  }

  if (estado.modo === 'local') {
    estado.familia = 'demo';
    $('#modo-demo').hidden = false; // la explicación está en la ayuda
  } else {
    const guardada = almacen.leer(CLAVE_FAMILIA);
    estado.familia = codigoFamiliaValido(guardada) ? guardada : null;
  }

  if (!estado.familia) pantallaFamilia();
  else await conectar();
}

async function conectar() {
  app.innerHTML = `<p class="cargando">${icono('tree-pine')} Cargando la lista…</p>`;
  try {
    if (estado.modo === 'firebase') {
      const { crearStoreFirebase } = await import('./datos-firebase.js');
      store = await crearStoreFirebase(window.FIREBASE_CONFIG, estado.familia);
    } else {
      const { crearStoreLocal } = await import('./datos-local.js');
      store = crearStoreLocal();
    }
  } catch (err) {
    console.error(err);
    pantallaError('No se pudo conectar con la base de datos. Revisa tu conexión a internet.', err);
    return;
  }

  estado.yo = almacen.leer(claveYo());

  // Firestore reintenta en silencio si no logra conectarse: avisamos si tarda demasiado.
  const avisoLento = setTimeout(() => {
    pantallaError('Está tardando más de lo normal en cargar. Revisa tu conexión a internet; '
      + 'si sigue igual, puede que la base de datos no esté bien configurada.');
  }, 12_000);

  store.suscribir(
    (datos) => {
      clearTimeout(avisoLento);
      estado.datos = datos;
      render();
    },
    (err) => {
      clearTimeout(avisoLento);
      console.error(err);
      pantallaError('Se perdió la conexión con la lista de la familia.', err);
    },
  );
}

function entrarAFamilia(codigo) {
  estado.familia = codigo;
  almacen.guardar(CLAVE_FAMILIA, codigo);
  conectar();
}

// ---------------------------------------------------------------------------
// Pantallas
// ---------------------------------------------------------------------------

function render() {
  const yo = yoActual();
  renderSesion(yo);
  if (!yo) {
    pantallaQuienEres();
    return;
  }
  const vistaValida = estado.vista === 'compras' || buscarMiembro(estado.vista);
  if (!vistaValida) estado.vista = yo.id;
  pantallaPrincipal(yo);
}

function avatar(miembro, tamano = '') {
  return `<span class="avatar ${tamano} tono-${tono(miembro.id)}" aria-hidden="true">${esc(miembro.emoji || '🎁')}</span>`;
}

function renderSesion(yo) {
  $('#sesion').innerHTML = yo
    ? `<button class="sesion" data-accion="menu" aria-haspopup="dialog" aria-label="Menú de ${esc(yo.nombre)}">
        ${avatar(yo, 'avatar-sm')}<span class="sesion-nombre">${esc(yo.nombre)}</span><span aria-hidden="true">▾</span>
      </button>`
    : '';
}

function pantallaFamilia() {
  renderSesion(null);
  app.innerHTML = `
    <section class="tarjeta bienvenida">
      <span class="insignia">${icono('gift')}</span>
      <h2>¡Bienvenido a la lista familiar!</h2>
      <p class="sutil">Para entrar necesitas el <strong>código familiar</strong>.
        Si alguien te mandó el enlace de invitación, ábrelo y entrarás directo.</p>
      <form id="form-familia" class="formulario formulario-angosto">
        <label class="campo">
          <span>Código familiar</span>
          <input name="codigo" required autocomplete="off" autocapitalize="none" spellcheck="false"
                 placeholder="xxxx-xxxx-xxxx">
        </label>
        <p class="error-form" role="alert" hidden></p>
        <button class="boton primario" type="submit">Entrar</button>
      </form>
      <div class="separador"><span>o</span></div>
      <button class="boton secundario" data-accion="crear-familia">${icono('sparkles')} Crear una familia nueva</button>
    </section>`;

  const form = $('#form-familia');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const codigo = normalizarCodigo(new FormData(form).get('codigo'));
    if (!codigoFamiliaValido(codigo)) {
      const error = form.querySelector('.error-form');
      error.textContent = 'Ese código no parece válido. Debe verse como «k7tq-mw3x-p9rd».';
      error.hidden = false;
      return;
    }
    entrarAFamilia(codigo);
  });
}

function pantallaQuienEres() {
  const miembros = miembrosOrdenados();
  const hay = miembros.length > 0;
  const pistaCodigo = estado.modo === 'firebase' && !hay && !estado.recienCreada
    ? `<p class="sutil pequeno">¿Esperabas ver a tu familia? Revisa el código <code>${esc(estado.familia)}</code>
        · <button class="enlace-boton" data-accion="salir-familia">Usar otro código</button></p>`
    : '';

  app.innerHTML = `
    <section class="tarjeta bienvenida">
      <span class="insignia">${icono('users')}</span>
      <h2>${hay ? '¿Quién eres?' : '¡Empecemos!'}</h2>
      <p class="sutil">${hay
        ? 'Elige tu nombre para ver tu lista y la de tu familia.'
        : 'Todavía no hay nadie en la lista familiar. Agrégate para empezar: '
          + 'quien se agregue primero será admin de la familia.'}</p>
      <div class="rejilla-miembros">
        ${miembros.map((m) => `
          <button class="miembro-opcion" data-accion="soy" data-id="${esc(m.id)}">
            ${avatar(m, 'avatar-lg')}<span>${esc(m.nombre)}</span>${esAdmin(m) ? insigniaAdmin() : ''}
          </button>`).join('')}
        <button class="miembro-opcion nuevo" data-accion="nuevo-miembro">
          <span class="avatar avatar-lg avatar-icono" aria-hidden="true">${icono('user-plus')}</span>
          <span>${hay ? 'No estoy en la lista' : 'Agregarme'}</span>
        </button>
      </div>
      ${pistaCodigo}
    </section>`;
}

function pantallaPrincipal(yo) {
  const otros = miembrosOrdenados().filter((m) => m.id !== yo.id);
  const compras = estado.datos.deseos.filter((d) => d.reservadoPor === yo.id && d.miembroId !== yo.id);

  const chip = (m) => {
    const activo = estado.vista === m.id;
    return `<button class="chip${activo ? ' activo' : ''}" data-accion="ver" data-id="${esc(m.id)}" aria-pressed="${activo}">
      ${avatar(m, 'avatar-sm')}<span>${m.id === yo.id ? 'Mi lista' : esc(m.nombre)}</span>
      <span class="conteo">${deseosDe(m.id).length}</span>
    </button>`;
  };
  const enCompras = estado.vista === 'compras';

  // En pantallas grandes la lista se desplaza dentro de su tarjeta: cada snapshot vuelve a
  // pintar todo, así que se conserva la posición si seguimos viendo la misma lista.
  const cuerpoAnterior = app.querySelector('.panel-cuerpo');
  const scrollPrevio = cuerpoAnterior?.dataset.vista === estado.vista ? cuerpoAnterior.scrollTop : 0;

  app.innerHTML = `
    <nav class="familia" aria-label="Listas de la familia">
      ${[yo, ...otros].map(chip).join('')}
      <button class="chip chip-compras${enCompras ? ' activo' : ''}" data-accion="ver" data-id="compras" aria-pressed="${enCompras}">
        <span class="avatar avatar-sm avatar-icono" aria-hidden="true">${icono('shopping-bag')}</span><span>Mis compras</span>
        <span class="conteo">${compras.length}</span>
      </button>
      <button class="chip chip-invitar" data-accion="invitar">
        <span class="avatar avatar-sm avatar-icono" aria-hidden="true">${icono('mail')}</span><span>Invitar</span>
      </button>
    </nav>
    ${enCompras ? panelCompras(compras) : panelLista(buscarMiembro(estado.vista), yo)}`;
  const cuerpo = app.querySelector('.panel-cuerpo');
  if (cuerpo && scrollPrevio) cuerpo.scrollTop = scrollPrevio;
}

function panelLista(miembro, yo) {
  const esMia = miembro.id === yo.id;
  const soyAdmin = esAdmin(yo);
  const deseos = deseosDe(miembro.id);
  const nombre = esc(miembro.nombre);

  // Las reglas (sorpresa, deseos fijos, admin) viven en la ayuda (botón ?), no en la tarjeta.
  // El admin puede sacar a otros de la familia (p. ej. perfiles repetidos), pero no a sí mismo.
  const pie = soyAdmin && !esMia
    ? `<div class="panel-pie">
        <button class="boton fantasma peligro" data-accion="eliminar-miembro" data-id="${esc(miembro.id)}">${icono('trash-2')} Eliminar a ${nombre} de la familia</button>
      </div>`
    : '';

  const vacio = esMia
    ? `<div class="vacio">
        <span class="insignia">${icono('gift')}</span>
        <p><strong>Tu lista está vacía.</strong><br>¿Qué te gustaría recibir esta Navidad?</p>
        <button class="boton primario" data-accion="nuevo-deseo">${icono('plus')} Agregar mi primer deseo</button>
      </div>`
    : `<div class="vacio">
        <span class="insignia">${icono('tree-pine')}</span>
        <p>${nombre} todavía no ha agregado deseos.</p>
      </div>`;

  return `
    <section class="tarjeta panel" aria-labelledby="titulo-panel">
      <header class="panel-cabecera">
        ${avatar(miembro, 'avatar-lg')}
        <div class="panel-titulo">
          <h2 id="titulo-panel">${esMia ? 'Mi lista' : `Lista de ${nombre}`}</h2>
          <p class="sutil">${plural(deseos.length, 'deseo', 'deseos')}${esAdmin(miembro) ? ` · ${insigniaAdmin()}` : ''}</p>
        </div>
        ${botonAyuda()}
        ${esMia && deseos.length ? `<button class="boton primario" data-accion="nuevo-deseo">${icono('plus')} Agregar deseo</button>` : ''}
      </header>
      <div class="panel-cuerpo" data-vista="${esc(miembro.id)}">
        ${deseos.length
          ? `<ul class="deseos">${deseos.map((d) => tarjetaDeseo(d, esMia, yo, soyAdmin)).join('')}</ul>`
          : vacio}
        ${pie}
      </div>
    </section>`;
}

function cuerpoDeseo(d) {
  const p = [1, 2, 3].includes(d.prioridad) ? d.prioridad : 2;
  const enlace = normalizarEnlace(d.enlace);
  return `
    <div class="deseo-cuerpo">
      <p class="estrellas" title="${PRIORIDADES[p]}">
        ${estrellas(p)}
        <span class="prioridad-texto">${PRIORIDADES[p]}</span>
      </p>
      <h3>${esc(d.titulo)}</h3>
      ${d.notas ? `<p class="notas">${esc(d.notas)}</p>` : ''}
      ${d.precio || enlace ? `
        <div class="meta">
          ${d.precio ? `<span class="etiqueta">${icono('tag')} ${esc(d.precio)}</span>` : ''}
          ${enlace ? `<a class="etiqueta enlace" href="${esc(enlace)}" target="_blank" rel="noopener noreferrer">${icono('external-link')} ${esc(dominio(enlace))}</a>` : ''}
        </div>` : ''}
    </div>`;
}

function tarjetaDeseo(d, esMia, yo, soyAdmin) {
  const id = esc(d.id);
  const apartadoPorMi = d.reservadoPor === yo.id;
  const apartadoPorOtro = Boolean(d.reservadoPor) && !apartadoPorMi;

  let acciones;
  let clase = '';
  if (esMia) {
    // El dueño nunca ve si algo de su lista está apartado. Sus deseos no se editan.
    acciones = '';
  } else if (apartadoPorMi) {
    clase = ' mio';
    acciones = `
      <span class="sello sello-mio">${icono('check')} Lo regalas tú</span>
      <button class="boton fantasma" data-accion="liberar" data-id="${id}">Ya no</button>`;
  } else if (apartadoPorOtro) {
    clase = ' apartado';
    acciones = `<span class="sello">${icono('lock')} Ya lo regala ${esc(nombreDe(d.reservadoPor))}</span>`;
  } else {
    // Mientras se confirma el apartado (el trineo ya va en camino) no se puede volver a tocar.
    const enCamino = vueloTrineo(d.id) !== null;
    acciones = `<button class="boton regalo" data-accion="reservar" data-id="${id}"${enCamino ? ' disabled' : ''}>${icono('gift')} Yo lo regalo</button>`;
  }
  if (soyAdmin) {
    acciones += `<button class="boton fantasma peligro boton-icono" data-accion="borrar-deseo" data-id="${id}"
      aria-label="Eliminar «${esc(d.titulo)}»" title="Eliminar">${icono('trash-2')}</button>`;
  }

  // Santa cruza la tarjeta recién apartada y la va pintando de dorado (.en-vuelo deja el fondo
  // normal mientras tanto). Nunca en la lista propia (sería delatar la sorpresa).
  const transcurrido = esMia ? null : vueloTrineo(d.id);
  const santa = transcurrido === null ? '' : trineo(transcurrido);
  if (santa) clase += ' en-vuelo';

  return `<li class="deseo${clase}">${cuerpoDeseo(d)}${acciones ? `<div class="deseo-acciones">${acciones}</div>` : ''}${santa}</li>`;
}

function panelCompras(compras) {
  const porPersona = new Map();
  for (const d of compras) {
    if (!porPersona.has(d.miembroId)) porPersona.set(d.miembroId, []);
    porPersona.get(d.miembroId).push(d);
  }
  const listos = compras.filter((d) => d.comprado).length;

  const grupos = [...porPersona.entries()].map(([id, lista]) => {
    const m = buscarMiembro(id) ?? { id, nombre: 'alguien', emoji: '🎁' };
    return `
      <div class="grupo">
        <h3 class="grupo-titulo">${avatar(m, 'avatar-sm')} Para ${esc(m.nombre)}</h3>
        <ul class="deseos">
          ${lista.map((d) => `
            <li class="deseo compra${d.comprado ? ' comprado' : ''}">
              <label ${atributosCheck(d.id)}>
                <input type="checkbox" data-accion="comprado" data-id="${esc(d.id)}"${d.comprado ? ' checked' : ''}>
                <span>${d.comprado ? 'Comprado' : 'Por comprar'}</span>
              </label>
              ${cuerpoDeseo(d)}
              <div class="deseo-acciones">
                <button class="boton fantasma" data-accion="liberar" data-id="${esc(d.id)}">Ya no lo regalo</button>
              </div>
            </li>`).join('')}
        </ul>
      </div>`;
  }).join('');

  return `
    <section class="tarjeta panel" aria-labelledby="titulo-panel">
      <header class="panel-cabecera">
        <span class="avatar avatar-lg avatar-icono" aria-hidden="true">${icono('shopping-bag')}</span>
        <div class="panel-titulo">
          <h2 id="titulo-panel">Mis compras</h2>
          <p class="sutil">${compras.length
            ? `${plural(compras.length, 'regalo apartado', 'regalos apartados')} · ${listos} comprado${listos === 1 ? '' : 's'}`
            : 'Aún no apartas ningún regalo'}</p>
        </div>
        ${botonAyuda()}
      </header>
      <div class="panel-cuerpo" data-vista="compras">
        ${compras.length ? grupos : `
          <div class="vacio">
            <span class="insignia">${icono('shopping-bag')}</span>
            <p>Aquí aparece lo que apartes. Entra a la lista de alguien de tu familia y toca <strong>«Yo lo regalo»</strong>.</p>
          </div>`}
      </div>
    </section>`;
}

function pantallaError(mensaje, err) {
  const sinPermiso = err?.code === 'permission-denied';
  app.innerHTML = `
    <section class="tarjeta bienvenida">
      <span class="insignia">${icono('snowflake')}</span>
      <h2>Ups, algo se congeló</h2>
      <p>${esc(mensaje)}</p>
      ${sinPermiso ? '<p class="sutil">La base de datos rechazó el acceso. Revisa que las reglas de Firestore estén publicadas.</p>' : ''}
      <div class="fila-botones">
        <button class="boton primario" data-accion="recargar">Reintentar</button>
        ${estado.modo === 'firebase' ? '<button class="boton fantasma" data-accion="salir-familia">Usar otro código</button>' : ''}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

/**
 * Muestra contenido en el diálogo modal. Si trae un <form>, al enviarlo se llama
 * alEnviar(formData): si devuelve un texto, se muestra como error y el diálogo sigue abierto.
 * Si alEnviar abre otro paso en el diálogo (llamando a abrirDialogo), tampoco se cierra.
 */
function abrirDialogo(html, alEnviar) {
  dialogo.innerHTML = html;
  const form = dialogo.querySelector('form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button[type="submit"]');
    const error = form.querySelector('.error-form');
    if (error) error.hidden = true;
    if (boton) boton.disabled = true;
    try {
      const resultado = await alEnviar?.(new FormData(form));
      if (typeof resultado === 'string') {
        if (error) {
          error.textContent = resultado;
          error.hidden = false;
          marcarDesborde();
          error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }
      if (form.isConnected) dialogo.close();
    } catch (err) {
      console.error(err);
      if (error) {
        error.textContent = 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
        error.hidden = false;
      }
    } finally {
      if (boton) boton.disabled = false;
    }
  });
  // showModal() enfoca [autofocus]; si el diálogo ya estaba abierto hay que hacerlo a mano.
  if (dialogo.open) dialogo.querySelector('[autofocus]')?.focus();
  else dialogo.showModal();
  marcarDesborde();
}

/** Marca el diálogo cuando su contenido no cabe y hay que desplazarse (los botones fijos muestran una línea). */
function marcarDesborde() {
  const contenido = dialogo.firstElementChild;
  dialogo.classList.toggle('desborda', Boolean(contenido) && contenido.scrollHeight > contenido.clientHeight + 1);
}

function confirmar({ titulo, texto, boton }) {
  return new Promise((resolve) => {
    // Ignora el evento "close" atrasado de un diálogo anterior (el diálogo ya está abierto de nuevo).
    const alCerrar = () => {
      if (dialogo.open) return;
      dialogo.removeEventListener('close', alCerrar);
      resolve(false);
    };
    abrirDialogo(`
      <form class="formulario">
        <h2>${esc(titulo)}</h2>
        <p>${esc(texto)}</p>
        <div class="dialogo-acciones">
          <button type="button" class="boton fantasma" data-accion="cerrar-dialogo">Cancelar</button>
          <button type="submit" class="boton peligro-solido">${esc(boton)}</button>
        </div>
      </form>`, () => resolve(true));
    dialogo.addEventListener('close', alCerrar);
  });
}

function formMiembro(miembro = null) {
  const elegido = miembro?.emoji ?? EMOJIS[estado.datos.miembros.length % EMOJIS.length];
  abrirDialogo(`
    <form class="formulario">
      <h2>${miembro ? 'Editar mi perfil' : '¡Bienvenido a la familia!'}</h2>
      <label class="campo">
        <span>Tu nombre</span>
        <input name="nombre" required maxlength="30" autocomplete="given-name" placeholder="Ej. Abuela Rosa"
               value="${esc(miembro?.nombre)}" autofocus>
      </label>
      <fieldset class="opciones">
        <legend>Elige tu personaje</legend>
        <div class="emojis">
          ${EMOJIS.map((e) => `
            <label><input type="radio" name="emoji" value="${e}"${e === elegido ? ' checked' : ''}><span>${e}</span></label>`).join('')}
        </div>
      </fieldset>
      <p class="error-form" role="alert" hidden></p>
      <div class="dialogo-acciones">
        <button type="button" class="boton fantasma" data-accion="cerrar-dialogo">Cancelar</button>
        <button type="submit" class="boton primario">${miembro ? 'Guardar' : 'Entrar'}</button>
      </div>
    </form>`, async (fd) => {
    const nombre = String(fd.get('nombre') ?? '').trim();
    if (!nombre) return 'Escribe tu nombre.';
    const repetido = estado.datos.miembros.some(
      (m) => m.id !== miembro?.id && m.nombre.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (repetido) {
      return `Ya hay alguien llamado ${nombre}. Si eres tú, elige tu nombre en la lista; si no, agrega tu apellido o un apodo.`;
    }
    const emoji = String(fd.get('emoji') || '🎁');

    if (miembro) {
      await store.actualizarMiembro(miembro.id, { nombre, emoji });
      aviso('Perfil actualizado');
      return undefined;
    }
    const id = await store.agregarMiembro({ nombre, emoji });
    elegirPersona(id);
    if (estado.recienCreada) {
      estado.recienCreada = false;
      setTimeout(invitar, 350);
    } else {
      aviso(`¡Hola, ${nombre}!`, 'sparkles');
    }
    return undefined;
  });
}

/** Formulario de un deseo nuevo (los deseos no se editan). `borrador` lo rellena al volver a corregir. */
function formDeseo(borrador = {}) {
  const prioridad = borrador.prioridad ?? 2;
  abrirDialogo(`
    <form class="formulario">
      <h2>Nuevo deseo</h2>
      <label class="campo">
        <span>¿Qué te gustaría recibir?</span>
        <input name="titulo" required maxlength="120" autocomplete="off" placeholder="Ej. Audífonos inalámbricos"
               value="${esc(borrador.titulo)}" autofocus>
      </label>
      <label class="campo">
        <span>Enlace <small>opcional</small></span>
        <input name="enlace" inputmode="url" maxlength="500" autocomplete="off" autocapitalize="none" spellcheck="false"
               placeholder="Pega aquí el link de la tienda" value="${esc(borrador.enlace)}">
      </label>
      <label class="campo">
        <span>Precio aproximado <small>opcional</small></span>
        <input name="precio" maxlength="30" autocomplete="off" placeholder="Ej. 250" value="${esc(borrador.precio)}">
      </label>
      <label class="campo">
        <span>Notas <small>opcional</small></span>
        <textarea name="notas" maxlength="300" rows="3" placeholder="Talla, color, modelo, tienda…">${esc(borrador.notas)}</textarea>
      </label>
      <fieldset class="opciones">
        <legend>¿Cuánto lo quieres?</legend>
        <div class="prioridades">
          ${[3, 2, 1].map((n) => `
            <label><input type="radio" name="prioridad" value="${n}"${n === prioridad ? ' checked' : ''}>
              <span><b>${estrellas(n)}</b> ${PRIORIDADES[n]}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <p class="error-form" role="alert" hidden></p>
      <div class="dialogo-acciones">
        <button type="button" class="boton fantasma" data-accion="cerrar-dialogo">Cancelar</button>
        <button type="submit" class="boton primario">Revisar y agregar</button>
      </div>
    </form>`, (fd) => {
    const titulo = String(fd.get('titulo') ?? '').trim();
    if (!titulo) return 'Escribe qué te gustaría recibir.';
    const enlace = normalizarEnlace(fd.get('enlace'));
    if (enlace === null) return 'El enlace no parece válido. Cópialo completo desde la página de la tienda.';
    borradorDeseo = {
      titulo,
      enlace,
      precio: String(fd.get('precio') ?? '').trim(),
      notas: String(fd.get('notas') ?? '').trim(),
      prioridad: Number(fd.get('prioridad')) || 2,
    };
    confirmarDeseo(borradorDeseo);
    return undefined;
  });
}

/** Segundo paso de «Nuevo deseo»: vista previa y aviso de que ya no se podrá cambiar. */
function confirmarDeseo(datos) {
  const advertencia = esAdmin(yoActual())
    ? '<strong>Una vez agregado no podrás editarlo</strong>, para que nadie compre algo que después cambió.'
    : '<strong>Una vez agregado no podrás editarlo ni eliminarlo</strong>, para que nadie compre algo '
      + `que después cambió. Si te equivocas, solo ${esc(adminFamilia()?.nombre)} (admin) podrá quitarlo.`;
  abrirDialogo(`
    <form class="formulario">
      <h2 tabindex="-1" autofocus>¿Todo bien?</h2>
      <p>Así se verá en tu lista. Revisa el nombre, el enlace y los detalles.</p>
      <div class="deseo vista-previa">${cuerpoDeseo(datos)}</div>
      <p class="advertencia">${icono('triangle-alert')}<span>${advertencia}</span></p>
      <p class="error-form" role="alert" hidden></p>
      <div class="dialogo-acciones">
        <button type="button" class="boton fantasma" data-accion="corregir-deseo">${icono('arrow-left')} Corregir</button>
        <button type="submit" class="boton primario">${icono('check')} Sí, agregarlo</button>
      </div>
    </form>`, async () => {
    await store.agregarDeseo({ ...datos, miembroId: estado.yo });
    borradorDeseo = null;
    aviso('¡Deseo agregado a tu lista!', 'gift');
  });
}

function menu() {
  const yo = yoActual();
  if (!yo) return;
  abrirDialogo(`
    <div class="menu">
      <div class="menu-cabecera">
        ${avatar(yo, 'avatar-lg')}
        <div>
          <h2>${esc(yo.nombre)}</h2>
          <p class="sutil">${esAdmin(yo) ? `${insigniaAdmin()} · ` : ''}${estado.modo === 'local' ? 'Modo demo' : `Familia <code>${esc(estado.familia)}</code>`}</p>
        </div>
      </div>
      <button class="menu-item" data-accion="editar-perfil">${icono('pencil')} Editar mi perfil</button>
      <button class="menu-item" data-accion="cambiar-persona">${icono('repeat')} No soy ${esc(yo.nombre)}</button>
      <button class="menu-item" data-accion="invitar">${icono('mail')} Invitar a la familia</button>
      <button class="menu-item" data-accion="ayuda">${icono('circle-help')} ¿Cómo funciona?</button>
      ${estado.modo === 'firebase' ? `<button class="menu-item" data-accion="salir-familia">${icono('log-out')} Salir de esta familia</button>` : ''}
      <div class="dialogo-acciones">
        <button class="boton fantasma" data-accion="cerrar-dialogo">Cerrar</button>
      </div>
    </div>`);
}

function invitar() {
  if (estado.modo === 'local') {
    abrirDialogo(`
      <div class="formulario">
        <h2>Invita a tu familia</h2>
        <p>Estás en <strong>modo demo</strong>: los datos solo existen en este navegador.
          Cuando la app esté conectada a la base de datos podrás compartir un enlace con toda la familia.</p>
        <div class="dialogo-acciones">
          <button class="boton primario" data-accion="cerrar-dialogo">Entendido</button>
        </div>
      </div>`);
    return;
  }

  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('familia', estado.familia);
  const mensaje = '🎄 ¡Armemos nuestra lista de deseos de Navidad! Entra aquí, elige tu nombre '
    + `y agrega lo que te gustaría recibir: ${url}`;

  abrirDialogo(`
    <div class="formulario">
      <h2>Invita a tu familia</h2>
      <p>Comparte este enlace. Quien lo abra entrará directo a las listas de la familia.</p>
      <div class="compartir">
        <input id="enlace-invitacion" readonly value="${esc(url.href)}" aria-label="Enlace de invitación">
        <button type="button" class="boton secundario" data-accion="copiar">${icono('copy')} Copiar</button>
      </div>
      <a class="boton whatsapp" href="https://wa.me/?text=${encodeURIComponent(mensaje)}" target="_blank" rel="noopener noreferrer">
        ${icono('message-circle')} Enviar por WhatsApp
      </a>
      <p class="sutil pequeno">Código familiar: <code>${esc(estado.familia)}</code><br>
        Cualquiera con este código o enlace puede ver las listas y agregar deseos: compártelo solo con la familia.</p>
      <div class="dialogo-acciones">
        <button class="boton fantasma" data-accion="cerrar-dialogo">Listo</button>
      </div>
    </div>`);
}

/** Las reglas de la app en un solo lugar (antes eran avisos fijos dentro de cada lista). */
function ayuda() {
  const yo = yoActual();
  const admin = adminFamilia();
  const poderes = 'Puede eliminar deseos de cualquier lista y sacar a alguien de la familia.';
  let textoAdmin;
  if (!admin) textoAdmin = `Quien se agregue primero a la familia. ${poderes}`;
  else if (esAdmin(yo)) textoAdmin = 'Eres tú: puedes eliminar deseos de cualquier lista y sacar a alguien de la familia.';
  else textoAdmin = `Es ${esc(admin.nombre)}. ${poderes} Si te equivocaste en un deseo, pídeselo.`;

  const punto = (nombre, titulo, texto) => `
    <li><span class="ayuda-icono">${icono(nombre)}</span><div><strong>${titulo}</strong><p>${texto}</p></div></li>`;
  abrirDialogo(`
    <div class="formulario">
      <h2>¿Cómo funciona?</h2>
      <ul class="ayuda-lista">
        ${punto('gift', '«Yo lo regalo»', 'Aparta un regalo de la lista de alguien para que nadie más lo compre. '
          + 'Lo verás en «Mis compras», donde puedes marcarlo cuando ya lo tengas.')}
        ${punto('eye-off', 'Es sorpresa', 'Tu familia puede apartar regalos de tu lista, pero tú no verás cuáles ni quién.')}
        ${punto('lock', 'Los deseos quedan fijos', 'Una vez agregados no se editan ni se borran, '
          + 'para que nadie compre algo que después cambió.')}
        ${punto('crown', 'Admin', textoAdmin)}
        ${estado.modo === 'local' ? punto('flask-conical', 'Modo demo', 'Los datos se guardan solo en este navegador. '
          + 'Cuando se conecte la base de datos, toda la familia verá las mismas listas.') : ''}
      </ul>
      <div class="dialogo-acciones">
        <button class="boton primario" data-accion="cerrar-dialogo">Entendido</button>
      </div>
    </div>`);
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function aviso(mensaje, nombreIcono = 'check') {
  const toast = $('#toast');
  toast.innerHTML = `${icono(nombreIcono)}<span>${esc(mensaje)}</span>`;
  toast.classList.add('visible');
  clearTimeout(aviso.temporizador);
  aviso.temporizador = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function elegirPersona(id) {
  estado.yo = id;
  estado.vista = id;
  almacen.guardar(claveYo(), id);
  render();
}

const acciones = {
  'cerrar-dialogo': () => dialogo.close(),
  recargar: () => location.reload(),
  menu,
  ayuda,
  celebrar: () => cuenta?.celebrar(), // la hoja «¡Feliz Navidad!» repite la celebración de medianoche

  soy: (id) => elegirPersona(id),
  ver: (id) => {
    estado.vista = id;
    render();
  },

  'nuevo-miembro': () => formMiembro(),
  'editar-perfil': () => formMiembro(yoActual()),
  'cambiar-persona': () => {
    dialogo.close();
    estado.yo = null;
    almacen.guardar(claveYo(), null);
    render();
  },
  // Solo el admin, y nunca a sí mismo (si no, el admin pasaría a ser otra persona).
  'eliminar-miembro': async (id) => {
    const miembro = buscarMiembro(id);
    if (!miembro || !esAdmin(yoActual()) || id === estado.yo) return;
    const ok = await confirmar({
      titulo: `¿Eliminar a ${miembro.nombre}?`,
      texto: 'Se borrará su lista de deseos y se liberarán los regalos que había apartado. Esto no se puede deshacer.',
      boton: 'Sí, eliminar',
    });
    if (!ok) return;
    await store.eliminarMiembro(id);
    aviso('Perfil eliminado', 'trash-2');
  },

  'nuevo-deseo': () => formDeseo(),
  'corregir-deseo': () => formDeseo(borradorDeseo ?? {}),
  // Solo el admin puede borrar deseos (de cualquier lista).
  'borrar-deseo': async (id) => {
    const deseo = buscarDeseo(id);
    const yo = yoActual();
    if (!deseo || !esAdmin(yo)) return;
    const esMio = deseo.miembroId === yo.id;
    let texto = esMio
      ? `«${deseo.titulo}» se quitará de tu lista.`
      : `«${deseo.titulo}» se quitará de la lista de ${nombreDe(deseo.miembroId)}.`;
    // En su propia lista el admin tampoco puede saber si algo está apartado.
    if (!esMio && deseo.reservadoPor === yo.id) {
      texto += ' Lo tenías apartado tú: saldrá de tus compras.';
    } else if (!esMio && deseo.reservadoPor) {
      texto += ` Ojo: ${nombreDe(deseo.reservadoPor)} ya lo apartó${deseo.comprado ? ' y lo marcó como comprado' : ''}.`;
    }
    const ok = await confirmar({
      titulo: '¿Eliminar este deseo?',
      texto: `${texto} Esto no se puede deshacer.`,
      boton: 'Eliminar',
    });
    if (!ok) return;
    await store.eliminarDeseo(id);
    aviso('Deseo eliminado', 'trash-2');
  },

  reservar: async (id) => {
    // Santa sale de inmediato (con Firestore la transacción tarda un momento en confirmarse).
    const viaje = matchMedia('(prefers-reduced-motion: reduce)').matches ? null : { id, inicio: performance.now() };
    if (viaje) {
      estado.trineo = viaje;
      setTimeout(() => {
        if (estado.trineo === viaje) estado.trineo = null;
      }, DURACION_TRINEO);
      render();
    }
    try {
      await store.reservarDeseo(id, estado.yo);
      aviso('¡Apartado! Ya está en «Mis compras»', 'gift');
    } catch (err) {
      if (viaje && estado.trineo === viaje) {
        estado.trineo = null;
        render();
      }
      if (err.code === 'ya-apartado') aviso('Alguien lo acaba de apartar', 'triangle-alert');
      else if (err.code === 'no-existe') aviso('Ese deseo ya no existe', 'triangle-alert');
      else throw err;
    }
  },
  liberar: async (id) => {
    await store.liberarDeseo(id, estado.yo);
    aviso('Listo, quedó disponible otra vez');
  },
  comprado: async (id, el) => {
    // Al marcarlo como comprado, el check da un saltito (la lista se repinta con el snapshot).
    if (el.checked && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      estado.salto = { id, inicio: performance.now() };
    }
    await store.marcarComprado(id, el.checked);
  },

  invitar: () => invitar(),
  copiar: async (_id, el) => {
    const input = $('#enlace-invitacion');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    el.innerHTML = `${icono('check')} ¡Copiado!`;
  },

  'crear-familia': () => {
    estado.recienCreada = true;
    entrarAFamilia(generarCodigoFamilia());
  },
  'salir-familia': async () => {
    const ok = await confirmar({
      titulo: '¿Salir de esta familia?',
      texto: 'Podrás volver a entrar con el mismo código o enlace de invitación. No se borra nada.',
      boton: 'Salir',
    });
    if (!ok) return;
    almacen.guardar(CLAVE_FAMILIA, null);
    location.reload();
  },
};

document.addEventListener('click', async (e) => {
  const elemento = e.target.closest('[data-accion]');
  const accion = acciones[elemento?.dataset.accion];
  if (!accion) return;
  try {
    await accion(elemento.dataset.id, elemento);
  } catch (err) {
    console.error(err);
    aviso('Algo salió mal. Revisa tu conexión e intenta de nuevo.', 'triangle-alert');
  }
});

// Cuando el trineo termina de cruzar se quitan sus capas (para no dejar animaciones corriendo
// fuera de vista) y la tarjeta se queda con su dorado normal (.mio), idéntico al de la pintura.
document.addEventListener('animationend', (e) => {
  if (e.animationName !== 'trineo-cruza') return;
  const tarjeta = e.target.closest('.deseo');
  tarjeta?.classList.remove('en-vuelo');
  tarjeta?.querySelector('.trineo-pintura')?.remove();
  e.target.closest('.trineo')?.remove();
});

// Clic fuera del contenido del diálogo (en el fondo oscuro) lo cierra.
dialogo.addEventListener('click', (e) => {
  if (e.target === dialogo) dialogo.close();
});

// Al girar el teléfono o abrirse el teclado cambia el alto disponible.
window.addEventListener('resize', () => {
  if (dialogo.open) marcarDesborde();
});

iniciar();
