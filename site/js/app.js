// Interfaz de la lista de deseos familiar.
// Renderiza con plantillas de texto y maneja los clics con un solo listener
// (atributos data-accion / data-id en los botones).

import {
  almacen,
  codigoFamiliaValido,
  cuentaRegresiva,
  dominio,
  esc,
  generarCodigoFamilia,
  normalizarCodigo,
  normalizarEnlace,
  tono,
} from './util.js';
import { iniciarNieve } from './nieve.js';

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
};

let store = null;

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
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const estrellas = (n) =>
  `<span aria-hidden="true">${'★'.repeat(n)}<span class="estrella-vacia">${'★'.repeat(3 - n)}</span></span>`;

// ---------------------------------------------------------------------------
// Arranque y conexión
// ---------------------------------------------------------------------------

async function iniciar() {
  iniciarNieve($('#nieve'));
  $('#cuenta').textContent = cuentaRegresiva();

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
    mostrarAviso('🧪 <strong>Modo demo:</strong> los datos se guardan solo en este navegador. '
      + 'Cuando se conecte la base de datos, toda la familia verá las mismas listas.');
  } else {
    const guardada = almacen.leer(CLAVE_FAMILIA);
    estado.familia = codigoFamiliaValido(guardada) ? guardada : null;
  }

  if (!estado.familia) pantallaFamilia();
  else await conectar();
}

async function conectar() {
  app.innerHTML = '<p class="cargando">Cargando la lista… 🎄</p>';
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

function mostrarAviso(html) {
  const aviso = $('#aviso');
  aviso.innerHTML = html;
  aviso.hidden = false;
}

function pantallaFamilia() {
  renderSesion(null);
  app.innerHTML = `
    <section class="tarjeta bienvenida">
      <p class="bienvenida-icono" aria-hidden="true">🎁</p>
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
      <button class="boton secundario" data-accion="crear-familia">✨ Crear una familia nueva</button>
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
      <p class="bienvenida-icono" aria-hidden="true">🎅</p>
      <h2>${hay ? '¿Quién eres?' : '¡Empecemos!'}</h2>
      <p class="sutil">${hay
        ? 'Elige tu nombre para ver tu lista y la de tu familia.'
        : 'Todavía no hay nadie en la lista familiar. Agrégate para empezar.'}</p>
      <div class="rejilla-miembros">
        ${miembros.map((m) => `
          <button class="miembro-opcion" data-accion="soy" data-id="${esc(m.id)}">
            ${avatar(m, 'avatar-lg')}<span>${esc(m.nombre)}</span>
          </button>`).join('')}
        <button class="miembro-opcion nuevo" data-accion="nuevo-miembro">
          <span class="avatar avatar-lg" aria-hidden="true">＋</span>
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

  app.innerHTML = `
    <nav class="familia" aria-label="Listas de la familia">
      ${[yo, ...otros].map(chip).join('')}
      <button class="chip chip-compras${enCompras ? ' activo' : ''}" data-accion="ver" data-id="compras" aria-pressed="${enCompras}">
        <span class="avatar avatar-sm" aria-hidden="true">🛍️</span><span>Mis compras</span>
        <span class="conteo">${compras.length}</span>
      </button>
      <button class="chip chip-invitar" data-accion="invitar">
        <span class="avatar avatar-sm" aria-hidden="true">💌</span><span>Invitar</span>
      </button>
    </nav>
    ${enCompras ? panelCompras(compras) : panelLista(buscarMiembro(estado.vista), yo)}`;
}

function panelLista(miembro, yo) {
  const esMia = miembro.id === yo.id;
  const deseos = deseosDe(miembro.id);
  const nombre = esc(miembro.nombre);

  const nota = esMia
    ? '🤫 Tu familia puede apartar regalos de tu lista, pero tú no verás cuáles. ¡Que sea sorpresa!'
    : `🎁 Toca «Yo lo regalo» para apartar un regalo y que nadie más lo compre. ${nombre} no verá quién lo apartó.`;

  const vacio = esMia
    ? `<div class="vacio">
        <p class="vacio-icono" aria-hidden="true">📝</p>
        <p><strong>Tu lista está vacía.</strong><br>¿Qué te gustaría recibir esta Navidad?</p>
        <button class="boton primario" data-accion="nuevo-deseo">＋ Agregar mi primer deseo</button>
      </div>`
    : `<div class="vacio">
        <p class="vacio-icono" aria-hidden="true">🦌</p>
        <p>${nombre} todavía no ha agregado deseos.</p>
      </div>`;

  return `
    <section class="tarjeta panel" aria-labelledby="titulo-panel">
      <header class="panel-cabecera">
        ${avatar(miembro, 'avatar-lg')}
        <div class="panel-titulo">
          <h2 id="titulo-panel">${esMia ? 'Mi lista' : `Lista de ${nombre}`}</h2>
          <p class="sutil">${plural(deseos.length, 'deseo', 'deseos')}</p>
        </div>
        ${esMia && deseos.length ? '<button class="boton primario" data-accion="nuevo-deseo">＋ Agregar deseo</button>' : ''}
      </header>
      <p class="nota">${nota}</p>
      ${deseos.length
        ? `<ul class="deseos">${deseos.map((d) => tarjetaDeseo(d, esMia, yo)).join('')}</ul>`
        : vacio}
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
          ${d.precio ? `<span class="etiqueta">💰 ${esc(d.precio)}</span>` : ''}
          ${enlace ? `<a class="etiqueta enlace" href="${esc(enlace)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(dominio(enlace))} ↗</a>` : ''}
        </div>` : ''}
    </div>`;
}

function tarjetaDeseo(d, esMia, yo) {
  const id = esc(d.id);
  const apartadoPorMi = d.reservadoPor === yo.id;
  const apartadoPorOtro = Boolean(d.reservadoPor) && !apartadoPorMi;

  let acciones;
  let clase = '';
  if (esMia) {
    // El dueño nunca ve si algo de su lista está apartado.
    acciones = `
      <button class="boton fantasma" data-accion="editar-deseo" data-id="${id}">Editar</button>
      <button class="boton fantasma peligro" data-accion="borrar-deseo" data-id="${id}">Eliminar</button>`;
  } else if (apartadoPorMi) {
    clase = ' mio';
    acciones = `
      <span class="sello sello-mio">✓ Lo regalas tú</span>
      <button class="boton fantasma" data-accion="liberar" data-id="${id}">Ya no</button>`;
  } else if (apartadoPorOtro) {
    clase = ' apartado';
    acciones = `<span class="sello">🔒 Ya lo regala ${esc(nombreDe(d.reservadoPor))}</span>`;
  } else {
    acciones = `<button class="boton regalo" data-accion="reservar" data-id="${id}">🎁 Yo lo regalo</button>`;
  }

  return `<li class="deseo${clase}">${cuerpoDeseo(d)}<div class="deseo-acciones">${acciones}</div></li>`;
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
              <label class="check">
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
        <span class="avatar avatar-lg" aria-hidden="true">🛍️</span>
        <div class="panel-titulo">
          <h2 id="titulo-panel">Mis compras</h2>
          <p class="sutil">${compras.length
            ? `${plural(compras.length, 'regalo apartado', 'regalos apartados')} · ${listos} comprado${listos === 1 ? '' : 's'}`
            : 'Aún no apartas ningún regalo'}</p>
        </div>
      </header>
      <p class="nota">🛒 Aquí aparece todo lo que apartaste con «Yo lo regalo». Marca cada regalo cuando ya lo tengas.</p>
      ${compras.length ? grupos : `
        <div class="vacio">
          <p class="vacio-icono" aria-hidden="true">🛷</p>
          <p>Entra a la lista de alguien de tu familia y toca <strong>«Yo lo regalo»</strong>.</p>
        </div>`}
    </section>`;
}

function pantallaError(mensaje, err) {
  const sinPermiso = err?.code === 'permission-denied';
  app.innerHTML = `
    <section class="tarjeta bienvenida">
      <p class="bienvenida-icono" aria-hidden="true">🥶</p>
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
        }
        return;
      }
      dialogo.close();
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
  if (!dialogo.open) dialogo.showModal();
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
      <h2>${miembro ? 'Editar mi perfil' : '¡Bienvenido a la familia! 🎄'}</h2>
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
        ${miembro ? `<button type="button" class="boton fantasma peligro a-la-izquierda" data-accion="eliminar-miembro" data-id="${esc(miembro.id)}">Eliminar perfil</button>` : ''}
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
      aviso('Perfil actualizado ✨');
      return undefined;
    }
    const id = await store.agregarMiembro({ nombre, emoji });
    elegirPersona(id);
    if (estado.recienCreada) {
      estado.recienCreada = false;
      setTimeout(invitar, 350);
    } else {
      aviso(`¡Hola, ${nombre}! 🎄`);
    }
    return undefined;
  });
}

function formDeseo(deseo = null) {
  const prioridad = deseo?.prioridad ?? 2;
  abrirDialogo(`
    <form class="formulario">
      <h2>${deseo ? 'Editar deseo' : 'Nuevo deseo ✨'}</h2>
      <label class="campo">
        <span>¿Qué te gustaría recibir?</span>
        <input name="titulo" required maxlength="120" autocomplete="off" placeholder="Ej. Audífonos inalámbricos"
               value="${esc(deseo?.titulo)}" autofocus>
      </label>
      <label class="campo">
        <span>Enlace <small>opcional</small></span>
        <input name="enlace" inputmode="url" maxlength="500" autocomplete="off" autocapitalize="none" spellcheck="false"
               placeholder="Pega aquí el link de la tienda" value="${esc(deseo?.enlace)}">
      </label>
      <label class="campo">
        <span>Precio aproximado <small>opcional</small></span>
        <input name="precio" maxlength="30" autocomplete="off" placeholder="Ej. 250" value="${esc(deseo?.precio)}">
      </label>
      <label class="campo">
        <span>Notas <small>opcional</small></span>
        <textarea name="notas" maxlength="300" rows="3" placeholder="Talla, color, modelo, tienda…">${esc(deseo?.notas)}</textarea>
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
        <button type="submit" class="boton primario">${deseo ? 'Guardar cambios' : 'Agregar a mi lista'}</button>
      </div>
    </form>`, async (fd) => {
    const titulo = String(fd.get('titulo') ?? '').trim();
    if (!titulo) return 'Escribe qué te gustaría recibir.';
    const enlace = normalizarEnlace(fd.get('enlace'));
    if (enlace === null) return 'El enlace no parece válido. Cópialo completo desde la página de la tienda.';
    const datos = {
      titulo,
      enlace,
      precio: String(fd.get('precio') ?? '').trim(),
      notas: String(fd.get('notas') ?? '').trim(),
      prioridad: Number(fd.get('prioridad')) || 2,
    };
    if (deseo) {
      await store.actualizarDeseo(deseo.id, datos);
      aviso('Cambios guardados ✨');
    } else {
      await store.agregarDeseo({ ...datos, miembroId: estado.yo });
      aviso('¡Deseo agregado a tu lista! ✨');
    }
    return undefined;
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
          <p class="sutil">${estado.modo === 'local' ? 'Modo demo' : `Familia <code>${esc(estado.familia)}</code>`}</p>
        </div>
      </div>
      <button class="menu-item" data-accion="editar-perfil">✏️ Editar mi perfil</button>
      <button class="menu-item" data-accion="cambiar-persona">🔄 No soy ${esc(yo.nombre)}</button>
      <button class="menu-item" data-accion="invitar">💌 Invitar a la familia</button>
      ${estado.modo === 'firebase' ? '<button class="menu-item" data-accion="salir-familia">🚪 Salir de esta familia</button>' : ''}
      <div class="dialogo-acciones">
        <button class="boton fantasma" data-accion="cerrar-dialogo">Cerrar</button>
      </div>
    </div>`);
}

function invitar() {
  if (estado.modo === 'local') {
    abrirDialogo(`
      <div class="formulario">
        <h2>Invita a tu familia 💌</h2>
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
      <h2>Invita a tu familia 💌</h2>
      <p>Comparte este enlace. Quien lo abra entrará directo a las listas de la familia.</p>
      <div class="compartir">
        <input id="enlace-invitacion" readonly value="${esc(url.href)}" aria-label="Enlace de invitación">
        <button type="button" class="boton secundario" data-accion="copiar">Copiar</button>
      </div>
      <a class="boton whatsapp" href="https://wa.me/?text=${encodeURIComponent(mensaje)}" target="_blank" rel="noopener noreferrer">
        Enviar por WhatsApp
      </a>
      <p class="sutil pequeno">Código familiar: <code>${esc(estado.familia)}</code><br>
        Cualquiera con este código o enlace puede ver y editar las listas: compártelo solo con la familia.</p>
      <div class="dialogo-acciones">
        <button class="boton fantasma" data-accion="cerrar-dialogo">Listo</button>
      </div>
    </div>`);
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function aviso(mensaje) {
  const toast = $('#toast');
  toast.textContent = mensaje;
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
  'eliminar-miembro': async (id) => {
    const miembro = buscarMiembro(id);
    if (!miembro) return;
    const ok = await confirmar({
      titulo: `¿Eliminar a ${miembro.nombre}?`,
      texto: 'Se borrará su lista de deseos y se liberarán los regalos que había apartado. Esto no se puede deshacer.',
      boton: 'Sí, eliminar',
    });
    if (!ok) return;
    await store.eliminarMiembro(id);
    if (id === estado.yo) {
      estado.yo = null;
      almacen.guardar(claveYo(), null);
    }
    aviso('Perfil eliminado');
    render();
  },

  'nuevo-deseo': () => formDeseo(),
  'editar-deseo': (id) => {
    const deseo = buscarDeseo(id);
    if (deseo) formDeseo(deseo);
  },
  'borrar-deseo': async (id) => {
    const deseo = buscarDeseo(id);
    if (!deseo) return;
    const ok = await confirmar({
      titulo: '¿Eliminar este deseo?',
      texto: `«${deseo.titulo}» se quitará de tu lista.`,
      boton: 'Eliminar',
    });
    if (!ok) return;
    await store.eliminarDeseo(id);
    aviso('Deseo eliminado');
  },

  reservar: async (id) => {
    try {
      await store.reservarDeseo(id, estado.yo);
      aviso('¡Apartado! Ya está en «Mis compras» 🎁');
    } catch (err) {
      if (err.code === 'ya-apartado') aviso('Alguien lo acaba de apartar 😅');
      else if (err.code === 'no-existe') aviso('Ese deseo ya no existe');
      else throw err;
    }
  },
  liberar: async (id) => {
    await store.liberarDeseo(id, estado.yo);
    aviso('Listo, quedó disponible otra vez');
  },
  comprado: async (id, el) => {
    await store.actualizarDeseo(id, { comprado: el.checked });
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
    el.textContent = '¡Copiado!';
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
    aviso('Algo salió mal. Revisa tu conexión e intenta de nuevo.');
  }
});

// Clic fuera del contenido del diálogo (en el fondo oscuro) lo cierra.
dialogo.addEventListener('click', (e) => {
  if (e.target === dialogo) dialogo.close();
});

iniciar();
