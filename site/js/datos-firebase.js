// Almacenamiento en Firebase Firestore (tiempo real, compartido por toda la familia).
// Expone la misma interfaz que datos-local.js.
//
// Estructura en Firestore:
//   familias/{codigoFamilia}/miembros/{id}  → { nombre, emoji, creado }
//   familias/{codigoFamilia}/deseos/{id}    → { miembroId, titulo, enlace, precio, notas,
//                                                prioridad, reservadoPor, comprado, creado }

import { errorConCodigo } from './util.js';

const VERSION_FIREBASE = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}`;

export async function crearStoreFirebase(config, familia) {
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);

  const app = initializeApp(config);
  let db;
  try {
    // Caché local: la app abre al instante y aguanta cortes breves de internet.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  const colMiembros = fs.collection(db, 'familias', familia, 'miembros');
  const colDeseos = fs.collection(db, 'familias', familia, 'deseos');
  const aLista = (snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  /** Cambia el estado de apartado de un deseo dentro de una transacción. */
  async function cambiarReserva(id, decidir) {
    const ref = fs.doc(colDeseos, id);
    await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw errorConCodigo('no-existe', 'El deseo ya no existe');
      const cambios = decidir(snap.data());
      if (cambios) tx.update(ref, cambios);
    });
  }

  return {
    suscribir(alCambiar, alError) {
      let miembros = null;
      let deseos = null;
      const emitir = () => {
        if (miembros && deseos) alCambiar({ miembros, deseos });
      };
      const cancelarMiembros = fs.onSnapshot(colMiembros, (snap) => {
        miembros = aLista(snap);
        emitir();
      }, alError);
      const cancelarDeseos = fs.onSnapshot(colDeseos, (snap) => {
        deseos = aLista(snap);
        emitir();
      }, alError);
      return () => {
        cancelarMiembros();
        cancelarDeseos();
      };
    },

    async agregarMiembro(miembro) {
      const ref = fs.doc(colMiembros);
      await fs.setDoc(ref, { ...miembro, creado: Date.now() });
      return ref.id;
    },

    async actualizarMiembro(id, cambios) {
      await fs.updateDoc(fs.doc(colMiembros, id), cambios);
    },

    /** Borra al integrante, su lista, y libera los regalos que había apartado. */
    async eliminarMiembro(id) {
      const [propios, apartados] = await Promise.all([
        fs.getDocs(fs.query(colDeseos, fs.where('miembroId', '==', id))),
        fs.getDocs(fs.query(colDeseos, fs.where('reservadoPor', '==', id))),
      ]);
      const lote = fs.writeBatch(db);
      lote.delete(fs.doc(colMiembros, id));
      propios.forEach((doc) => lote.delete(doc.ref));
      apartados.forEach((doc) => {
        if (doc.data().miembroId !== id) lote.update(doc.ref, { reservadoPor: null, comprado: false });
      });
      await lote.commit();
    },

    async agregarDeseo(deseo) {
      const ref = fs.doc(colDeseos);
      await fs.setDoc(ref, { ...deseo, reservadoPor: null, comprado: false, creado: Date.now() });
      return ref.id;
    },

    // Un deseo no se edita después de creado (firestore.rules lo impide);
    // solo cambian el apartado (reservar/liberar) y si ya se compró.
    async marcarComprado(id, comprado) {
      await fs.updateDoc(fs.doc(colDeseos, id), { comprado });
    },

    async eliminarDeseo(id) {
      await fs.deleteDoc(fs.doc(colDeseos, id));
    },

    // Con transacción: si dos personas tocan "Yo lo regalo" a la vez, solo una gana.
    async reservarDeseo(id, miembroId) {
      await cambiarReserva(id, (deseo) => {
        if (deseo.reservadoPor && deseo.reservadoPor !== miembroId) {
          throw errorConCodigo('ya-apartado', 'Otra persona ya apartó este regalo');
        }
        return { reservadoPor: miembroId, comprado: false };
      });
    },

    async liberarDeseo(id, miembroId) {
      await cambiarReserva(id, (deseo) =>
        deseo.reservadoPor === miembroId ? { reservadoPor: null, comprado: false } : null);
    },
  };
}
