// Almacenamiento "modo demo": todo vive en el localStorage de este navegador.
// Expone la misma interfaz que datos-firebase.js.

import { almacen, errorConCodigo, generarId } from './util.js';

const CLAVE = 'ldn.demo.datos';

function cargar() {
  try {
    const guardado = JSON.parse(almacen.leer(CLAVE) || '{}');
    return { miembros: guardado.miembros || {}, deseos: guardado.deseos || {} };
  } catch {
    return { miembros: {}, deseos: {} };
  }
}

export function crearStoreLocal() {
  let datos = cargar();
  const oyentes = new Set();

  const instantanea = () => ({
    miembros: Object.entries(datos.miembros).map(([id, m]) => ({ id, ...m })),
    deseos: Object.entries(datos.deseos).map(([id, d]) => ({ id, ...d })),
  });
  const avisar = () => {
    const actual = instantanea();
    oyentes.forEach((fn) => fn(actual));
  };
  const modificar = (cambio) => {
    cambio(datos);
    almacen.guardar(CLAVE, JSON.stringify(datos));
    avisar();
  };

  // Mantiene sincronizadas varias pestañas del mismo navegador.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE) return;
    datos = cargar();
    avisar();
  });

  const deseoExistente = (id) => {
    const deseo = datos.deseos[id];
    if (!deseo) throw errorConCodigo('no-existe', 'El deseo ya no existe');
    return deseo;
  };

  return {
    suscribir(alCambiar) {
      oyentes.add(alCambiar);
      queueMicrotask(() => alCambiar(instantanea()));
      return () => oyentes.delete(alCambiar);
    },

    async agregarMiembro(miembro) {
      const id = generarId();
      modificar((d) => {
        d.miembros[id] = { ...miembro, creado: Date.now() };
      });
      return id;
    },

    async actualizarMiembro(id, cambios) {
      modificar((d) => {
        if (d.miembros[id]) Object.assign(d.miembros[id], cambios);
      });
    },

    /** Borra al integrante, su lista, y libera los regalos que había apartado. */
    async eliminarMiembro(id) {
      modificar((d) => {
        delete d.miembros[id];
        for (const [idDeseo, deseo] of Object.entries(d.deseos)) {
          if (deseo.miembroId === id) delete d.deseos[idDeseo];
          else if (deseo.reservadoPor === id) Object.assign(deseo, { reservadoPor: null, comprado: false });
        }
      });
    },

    async agregarDeseo(deseo) {
      const id = generarId();
      modificar((d) => {
        d.deseos[id] = { ...deseo, reservadoPor: null, comprado: false, creado: Date.now() };
      });
      return id;
    },

    // Un deseo no se edita después de creado: solo cambian el apartado y si ya se compró.
    async marcarComprado(id, comprado) {
      modificar((d) => {
        if (d.deseos[id]) d.deseos[id].comprado = comprado;
      });
    },

    async eliminarDeseo(id) {
      modificar((d) => {
        delete d.deseos[id];
      });
    },

    async reservarDeseo(id, miembroId) {
      const deseo = deseoExistente(id);
      if (deseo.reservadoPor && deseo.reservadoPor !== miembroId) {
        throw errorConCodigo('ya-apartado', 'Otra persona ya apartó este regalo');
      }
      modificar(() => Object.assign(deseo, { reservadoPor: miembroId, comprado: false }));
    },

    async liberarDeseo(id, miembroId) {
      const deseo = deseoExistente(id);
      if (deseo.reservadoPor !== miembroId) return;
      modificar(() => Object.assign(deseo, { reservadoPor: null, comprado: false }));
    },
  };
}
