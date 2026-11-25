// Animación de entrada (árbol de estrellas). El script del <head> de index.html decide si
// se muestra (una vez por sesión, nunca con «reducir movimiento») y el CSS la anima.
// Aquí solo se permite saltarla y se quita del DOM al terminar.

export function iniciarIntro() {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const raiz = document.documentElement;
  if (!raiz.classList.contains('intro-activa')) {
    intro.remove();
    return;
  }

  const saltar = () => raiz.classList.add('intro-saltar');
  intro.addEventListener('click', saltar);
  document.addEventListener('keydown', saltar);

  intro.addEventListener('animationend', (e) => {
    // Las animaciones de cada estrella también llegan aquí (burbujean): solo cuenta la de la capa.
    if (e.target !== intro) return;
    intro.remove();
    document.removeEventListener('keydown', saltar);
  });
}
