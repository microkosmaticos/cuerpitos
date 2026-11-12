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

/**
 * Ajuste "cover" para una imagen que tiene que llenar el canvas sin
 * deformarse: escala hasta cubrir y centra. Lo que sobra se recorta.
 *
 * Devuelve el rectángulo donde hay que dibujar la imagen y la escala
 * usada, para poder proyectar coordenadas normalizadas (0..1) de la
 * imagen al canvas con la misma cuenta.
 */
export function calcularCubrir(anchoFuente, altoFuente, anchoCanvas, altoCanvas) {
  if (!(anchoFuente > 0) || !(altoFuente > 0)) {
    return { x: 0, y: 0, w: anchoCanvas, h: altoCanvas, escala: 1 };
  }

  const escala = Math.max(anchoCanvas / anchoFuente, altoCanvas / altoFuente);
  const w = anchoFuente * escala;
  const h = altoFuente * escala;

  return {
    x: (anchoCanvas - w) / 2,
    y: (altoCanvas - h) / 2,
    w,
    h,
    escala,
  };
}
