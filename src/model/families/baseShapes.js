// ============================================================
// baseShapes.js
//
// Generadores de SILUETAS base para las familias anatómicas.
// Todos devuelven una lista de puntos {x, y} en coordenadas
// locales, sin usar p5 y SIN aleatoriedad: la misma entrada
// siempre da exactamente los mismos puntos.
//
// La idea: una familia declara "forma base: blob" y los tamaños;
// este archivo se encarga de convertir eso en una silueta.
//
// MEDIDAS (todas en píxeles del espacio local):
//   - radio: es el RADIO de la masa, NO el diámetro.
//   - largo: distancia de la base a la punta.
//   - grosor: ancho en la base.
// ============================================================

// Cuántos puntos usamos para una masa redonda.
const PASOS_BLOB = 96;
// Cuántos puntos usamos a lo largo de un apéndice.
const PASOS_APENDICE = 24;

/**
 * Masa blanda y redondeada.
 * La silueta nunca es un círculo perfecto: la deforman dos ondas
 * suaves de distinta frecuencia. Siempre la misma deformación.
 *
 * @param {{ radio: number, irregularidad?: number }} medidas
 *   radio = RADIO de la masa (no el diámetro)
 */
export function crearBlob({ radio, irregularidad = 0.14 }) {
  const puntos = [];

  for (let i = 0; i < PASOS_BLOB; i++) {
    const angulo = (Math.PI * 2 * i) / PASOS_BLOB;

    // Suma de dos ondas: una grande y una chica.
    const onda = Math.sin(angulo * 3 + 0.6) * 0.6 + Math.sin(angulo * 5 + 2.1) * 0.4;
    const radioActual = radio * (1 + irregularidad * onda);

    puntos.push({
      x: Math.cos(angulo) * radioActual,
      y: Math.sin(angulo) * radioActual,
    });
  }

  return puntos;
}

/** Masa más redonda, para encadenar lóbulos. */
export function crearLobulo({ radio }) {
  return crearBlob({ radio, irregularidad: 0.1 });
}

/** Masa más irregular, para los cuerpos hechos de masas grandes. */
export function crearMasa({ radio }) {
  return crearBlob({ radio, irregularidad: 0.18 });
}

/**
 * Apéndice alargado que sale de un punto y se curva.
 *
 * El punto de giro es (0, 0): la BASE del apéndice. Por eso después
 * alcanza con rotarlo y moverlo al borde del núcleo.
 *
 * - largo: distancia de la base a la punta
 * - grosor: ancho en la base
 * - curva: cuánto se desvía hacia un costado en el medio
 * - afinado: qué tan fina termina la punta (0 = punta perfecta)
 */
export function crearApendice({ largo, grosor, curva = 0, afinado = 0.35 }) {
  // 1. Línea central del apéndice, de la base a la punta.
  const centro = [];
  for (let i = 0; i <= PASOS_APENDICE; i++) {
    const t = i / PASOS_APENDICE;
    centro.push({
      x: largo * t,
      // sin(pi * t) vale 0 en la base, 1 en el medio y 0 en la punta:
      // así la curva es un arco suave.
      y: curva * Math.sin(Math.PI * t),
    });
  }

  // 2. A cada lado de la línea central, a media distancia del grosor.
  const ladoA = [];
  const ladoB = [];

  for (let i = 0; i <= PASOS_APENDICE; i++) {
    const t = i / PASOS_APENDICE;
    const medioGrosor = (grosor / 2) * (1 - (1 - afinado) * t);

    // Dirección de la línea central en este punto (diferencia finita).
    const anterior = centro[Math.max(0, i - 1)];
    const siguiente = centro[Math.min(PASOS_APENDICE, i + 1)];
    const dx = siguiente.x - anterior.x;
    const dy = siguiente.y - anterior.y;
    const modulo = Math.hypot(dx, dy) || 1;

    // Perpendicular a la dirección.
    const nx = -dy / modulo;
    const ny = dx / modulo;

    ladoA.push({ x: centro[i].x + nx * medioGrosor, y: centro[i].y + ny * medioGrosor });
    ladoB.push({ x: centro[i].x - nx * medioGrosor, y: centro[i].y - ny * medioGrosor });
  }

  // 3. Un lado de ida y el otro de vuelta forman el contorno cerrado.
  return [...ladoA, ...ladoB.reverse()];
}

/** Punta afilada: un apéndice que termina casi en un punto. */
export function crearPunta({ largo, base, curva = 0 }) {
  return crearApendice({ largo, grosor: base, curva, afinado: 0.02 });
}
