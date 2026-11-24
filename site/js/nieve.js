// Nieve cayendo sobre el encabezado. Respeta "reducir movimiento" del sistema
// (en ese caso dibuja la nieve quieta) y se pausa cuando la pestaña no se ve.

export function iniciarNieve(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;

  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ancho = 0;
  let alto = 0;
  let copos = [];
  let animacion = null;

  const nuevoCopo = (enCualquierAltura) => ({
    x: Math.random() * ancho,
    y: enCualquierAltura ? Math.random() * alto : -6,
    radio: 0.8 + Math.random() * 2.2,
    velocidad: 0.25 + Math.random() * 0.7,
    fase: Math.random() * Math.PI * 2,
    opacidad: 0.35 + Math.random() * 0.5,
  });

  function dibujar(mover) {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = '#ffffff';
    for (const c of copos) {
      if (mover) {
        c.y += c.velocidad;
        c.fase += 0.012;
        c.x += Math.sin(c.fase) * 0.35;
        if (c.y > alto + 6) Object.assign(c, nuevoCopo(false));
        if (c.x < -6) c.x = ancho + 6;
        else if (c.x > ancho + 6) c.x = -6;
      }
      ctx.globalAlpha = c.opacidad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ajustar() {
    const caja = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = caja.width;
    alto = caja.height;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cantidad = Math.round(Math.min(120, (ancho * alto) / 3500));
    copos = Array.from({ length: cantidad }, () => nuevoCopo(true));
    if (!animacion) dibujar(false);
  }

  const cuadro = () => {
    dibujar(true);
    animacion = requestAnimationFrame(cuadro);
  };
  const arrancar = () => {
    if (animacion || reducirMovimiento.matches || document.hidden) return;
    animacion = requestAnimationFrame(cuadro);
  };
  const detener = () => {
    cancelAnimationFrame(animacion);
    animacion = null;
  };

  if ('ResizeObserver' in window) new ResizeObserver(ajustar).observe(canvas);
  else window.addEventListener('resize', ajustar);
  document.addEventListener('visibilitychange', () => (document.hidden ? detener() : arrancar()));
  reducirMovimiento.addEventListener?.('change', () => {
    if (reducirMovimiento.matches) {
      detener();
      dibujar(false);
    } else {
      arrancar();
    }
  });

  ajustar();
  arrancar();
}
