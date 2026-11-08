// ============================================================
// baseShapes.js
//
// Generadores de FORMA BASE. Todos devuelven lo mismo:
//   { points, extras, direccion }
//
//   - points:    la silueta, como lista de puntos {x, y}
//   - extras:    decoraciones que viajan pegadas (por ejemplo, los ojos
//                de una cabeza). Se dibujan encima y escalan junto con
//                la parte.
//   - direccion: hacia dónde apunta la parte en su forma original
//                (en radianes). El constructor la usa para rotarla.
//
// MEDIDAS (todas en píxeles del espacio local):
//   - radius → RADIO de una esfera (NO el diámetro)
//   - width  → ancho máximo de una silueta
//   - height → alto máximo de una silueta
//   - Una silueta NO se mide con radius: no es redonda.
//
// Acá no hay aleatoriedad: la misma entrada da los mismos puntos.
// ============================================================

const PASOS_ESFERA = 96;

/**
 * Esfera perfecta. "radio" es RADIO, no diámetro.
 *
 * Se devuelve con el punto de unión en el origen y la esfera hacia +X,
 * igual que las siluetas: así se puede colgar del borde de otra parte.
 * Cuando la esfera es el núcleo (no cuelga de nadie), el constructor
 * la vuelve a centrar.
 */
export function crearEsfera({ radio }) {
  const points = [];

  for (let i = 0; i < PASOS_ESFERA; i++) {
    const angulo = (Math.PI * 2 * i) / PASOS_ESFERA;
    points.push({
      x: radio + Math.cos(angulo) * radio,
      y: Math.sin(angulo) * radio,
    });
  }

  return { points, extras: [], direccion: 0 };
}

/**
 * Toma una silueta de la biblioteca (ver silhouettes.js) y la escala
 * a un ancho y un alto concretos.
 *
 * El ancho y el alto se piden por separado a propósito: así el cuerpo
 * se puede estirar a lo ancho o a lo alto y no siempre es el mismo.
 */
export function crearSilueta(silueta, width, height) {
  const caja = calcularBounds(silueta.puntos);

  // Cuánto hay que estirar cada eje para llegar a la medida pedida.
  const escalaX = caja.width > 0 ? width / caja.width : 1;
  const escalaY = caja.height > 0 ? height / caja.height : 1;

  return {
    points: escalar(silueta.puntos, escalaX, escalaY),
    extras: silueta.ojos.map((ojo) => escalar(ojo, escalaX, escalaY)),
    direccion: silueta.direccion,
  };
}

function escalar(puntos, escalaX, escalaY) {
  return puntos.map((punto) => ({ x: punto.x * escalaX, y: punto.y * escalaY }));
}

function calcularBounds(puntos) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const punto of puntos) {
    if (punto.x < minX) minX = punto.x;
    if (punto.y < minY) minY = punto.y;
    if (punto.x > maxX) maxX = punto.x;
    if (punto.y > maxY) maxY = punto.y;
  }

  return { width: maxX - minX, height: maxY - minY };
}
