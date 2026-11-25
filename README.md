# 🎄 Deseos de Navidad 2026

Web sencilla para que cada integrante de la familia tenga su lista de deseos de Navidad y todos puedan verla.

## Qué hace

- Cada persona elige su nombre (y un personaje 🎅🤶⛄…) y arma su lista: qué quiere, enlace de la tienda, precio aproximado, notas y qué tanto lo quiere (★ a ★★★).
- Antes de agregar un deseo se muestra una vista previa para revisarlo: una vez agregado **no se puede editar ni borrar**, para que nadie compre algo que después cambió.
- **Admin 👑**: quien creó la familia (el primer integrante). Es el único que puede eliminar deseos de cualquier lista y sacar a alguien de la familia.
- Todos ven las listas de los demás y pueden **apartar** un regalo con «Yo lo regalo», para que nadie compre lo mismo.
- El dueño de la lista **no ve** qué le apartaron: ¡sorpresa!
- **Mis compras**: todo lo que apartaste, agrupado por persona, con casilla de «comprado».
- Enlace de invitación para mandar por WhatsApp.
- Animación de entrada con un árbol de estrellas (una vez por sesión), cuenta regresiva en vivo con hojas de calendario (días, horas, minutos y segundos) hasta la medianoche de Nochebuena y nieve en el encabezado.
- Diseño de tarjeta navideña: fondo verde con copos, marco, acebo en las esquinas, luces cálidas y títulos en letra de pincel.
- Íconos de [Lucide](https://lucide.dev) (licencia ISC) y una ayuda «¿Cómo funciona?» con las reglas, para que las listas muestren solo los regalos.

## Cómo está hecha

| Pieza | Qué se usa |
|---|---|
| Interfaz | HTML + CSS + JavaScript puro, sin frameworks ni compilación |
| Base de datos | [Firebase Firestore](https://firebase.google.com/docs/firestore) (plan gratuito), con cambios en tiempo real |
| Hosting | GitHub Pages, publicado por **GitHub Actions** en cada push a `main` |

Si no hay configuración de Firebase, la app funciona en **modo demo**: los datos se guardan solo en el navegador.

```
site/                    → la web que se publica
  index.html
  config.js              → configuración de Firebase (GitHub Actions lo genera al publicar)
  css/estilos.css
  js/app.js              → pantallas y acciones
  js/datos-local.js      → almacenamiento del modo demo (localStorage)
  js/datos-firebase.js   → almacenamiento en Firestore
  js/nieve.js            → animación de nieve
  js/util.js             → utilidades
firestore.rules          → reglas de seguridad de Firestore
.github/workflows/publicar.yml → despliegue a GitHub Pages
```

## Probarla en tu computadora

Necesitas Python (o cualquier servidor de archivos estáticos):

```bash
python -m http.server 8000 -d site
```

Abre <http://localhost:8000>. Corre en modo demo.

## Puesta en marcha (una sola vez)

### 1. Crear la base de datos en Firebase

1. Entra a <https://console.firebase.google.com> y crea un proyecto (Google Analytics y la asistencia de IA no hacen falta). Usa el plan gratuito **Spark**; no hace falta tarjeta.
2. Menú izquierdo **Databases & Storage → Firestore → Create database** (en español: *Bases de datos y almacenamiento → Firestore → Crear base de datos*). Si pregunta la edición, elige **Standard**. Elige una ubicación en Estados Unidos (por ejemplo `nam5`), que **no se puede cambiar después**, y **Production mode** (modo de producción).
3. En la pestaña **Reglas**, reemplaza todo por el contenido de [`firestore.rules`](firestore.rules) y presiona **Publicar**.
4. En **Configuración del proyecto (⚙️ junto a «Descripción general») → General → Tus apps**, toca el ícono **Web (`</>`)**, ponle un apodo, deja **sin marcar** Firebase Hosting y presiona **Registrar app**. Copia los valores de `firebaseConfig`. Si los necesitas después, están en la misma sección, opción **Config**.

### 2. Configurar GitHub

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   GitHub Pages en el plan gratuito requiere que el repositorio sea **público**. El código no contiene datos de la familia.
2. **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**:
   - Nombre: `FIREBASE_CONFIG`
   - Valor: el `firebaseConfig` en formato **JSON** (claves entre comillas dobles):

     ```json
     {
       "apiKey": "AIza...",
       "authDomain": "mi-proyecto.firebaseapp.com",
       "projectId": "mi-proyecto",
       "storageBucket": "mi-proyecto.appspot.com",
       "messagingSenderId": "1234567890",
       "appId": "1:1234567890:web:abcdef"
     }
     ```
3. Haz push a `main`, o ve a **Actions → Publicar en GitHub Pages → Run workflow**. Al terminar, el enlace aparece en el resumen del workflow (algo como `https://<usuario>.github.io/ListaDeseosNavidad2026/`).

### 3. Invitar a la familia

1. Abre la web y toca **Crear una familia nueva**. Se genera un código familiar como `k7tq-mw3x-p9rd`.
2. Agrégate con tu nombre.
3. Comparte el **enlace de invitación** (botón 💌 Invitar). Quien lo abra entra directo a la familia.

## Seguridad y privacidad

- La web es pública, pero **las listas solo se ven con el código familiar** (≈59 bits aleatorios: imposible de adivinar). Cualquiera que tenga el código o el enlace puede ver las listas y participar, así que compártelo solo con la familia.
- No hay contraseñas por persona: cada quien elige su nombre al entrar (sistema de confianza familiar). Por lo mismo, el rol de admin solo existe en la app: quien elija el nombre del admin tiene sus permisos.
- Las reglas de Firestore impiden editar un deseo ya creado (solo se puede apartar, liberar o marcar como comprado). Que solo el admin borre no se puede exigir en las reglas sin cuentas de usuario.
- La «sorpresa» (quién apartó qué) se oculta en la pantalla del dueño de la lista, pero el dato existe en la base de datos.
- La configuración de Firebase (`apiKey`, etc.) no es secreta; la protección real la dan las reglas de `firestore.rules`.
