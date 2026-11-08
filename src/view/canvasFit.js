// ============================================================
// canvasFit.js
//
// La misma cuenta para las dos vistas: qué escala usar y dónde está
// el centro de la forma, para que entre en pantalla sin deformarse.
//
// Al estar acá, la vista de formas y la galería de familias no
// repiten la matemática.
// ============================================================

export function calcularAjuste(bounds, anchoCanvas, altoCanvas, margen = 90) {
  const anchoDisponible = anchoCanvas - margen * 2;
  const altoDisponible = altoCanvas - margen * 2;

  let escala = 1;
  if (bounds.width > 0 && bounds.height > 0) {
    // La misma escala para ancho y alto: así no se deforma.
    escala = Math.min(anchoDisponible / bounds.width, altoDisponible / bounds.height);
  }

  if (!Number.isFinite(escala) || escala <= 0) escala = 1;

  return {
    escala,
    centroX: bounds.x + bounds.width / 2,
    centroY: bounds.y + bounds.height / 2,
  };
}
