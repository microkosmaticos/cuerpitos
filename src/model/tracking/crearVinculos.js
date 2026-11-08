// ============================================================
// crearVinculos.js
//
// VÍNCULO parte ↔ ancla de tracking.
//
// Al nacer, cada parte móvil recibe:
//   - un ancla abstracta (0..6) elegida al azar pero FIJA para toda
//     la vida del organismo,
//   - una fase, para cuando hay más partes que anclas,
//   - un "temperamento": ganancia, retraso, rigidez y amortiguación.
//
// Usa un generador PROPIO derivado de la semilla, igual que la paleta:
// así agregar el vínculo no cambia ni la anatomía ni la paleta de una
// semilla ya conocida.
//
// La cabeza y los ojos NO reciben ancla: van rígidos con el torso.
// ============================================================

import { SeededRandom } from "../random/SeededRandom.js";
import { congelarProfundo } from "../families/deepFreeze.js";
import { CANTIDAD_DE_ANCLAS } from "./TrackingFrame.js";

// Constante fija para derivar la semilla de los vínculos.
const CONSTANTE_DE_VINCULOS = 0x27d4eb2f;

/**
 * Rangos del temperamento. Están pensados para que el organismo
 * responda, pero NUNCA copie el movimiento humano:
 *   - ganancia < 0.55: el ángulo es una fracción de la desviación
 *   - retraso 0.08–0.28 s: se nota el arrastre sin quedar desconectado
 *   - rigidez 6–14: vuelve al reposo en menos de un segundo
 *   - amortiguación 0.85–1.15 del crítico: no oscila
 */
export const TEMPERAMENTO = congelarProfundo({
  ganancia: { min: 0.18, max: 0.55 },
  retraso: { min: 0.08, max: 0.28 },
  rigidez: { min: 6, max: 14 },
  amortiguacion: { min: 0.85, max: 1.15 },
});

/**
 * @param {object} shape forma ya construida (tiene las partes con rol y ancla)
 * @param {number|string} seed semilla del organismo
 */
export function crearVinculos(shape, seed) {
  const rng = new SeededRandom((Number(seed) ^ CONSTANTE_DE_VINCULOS) >>> 0);

  // Mezcla de las anclas: parte 1 no tiene por qué seguir el ancla 1.
  const anclas = Array.from({ length: CANTIDAD_DE_ANCLAS }, (_, i) => i);
  for (let i = anclas.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const auxiliar = anclas[i];
    anclas[i] = anclas[j];
    anclas[j] = auxiliar;
  }

  // La cabeza va rígida con el torso: no participa del tracking.
  const moviles = shape.parts.filter(
    (parte) => parte.role !== "nucleo" && parte.role !== "cabeza"
  );

  const vinculos = moviles.map((parte, indice) => ({
    partId: parte.id,
    ancla: anclas[indice % anclas.length],
    // Si hay más partes que anclas, la fase agrega un retraso extra.
    fase: Math.floor(indice / anclas.length),
    ganancia: rng.range(TEMPERAMENTO.ganancia.min, TEMPERAMENTO.ganancia.max),
    retraso: rng.range(TEMPERAMENTO.retraso.min, TEMPERAMENTO.retraso.max),
    rigidez: rng.range(TEMPERAMENTO.rigidez.min, TEMPERAMENTO.rigidez.max),
    amortiguacion: rng.range(TEMPERAMENTO.amortiguacion.min, TEMPERAMENTO.amortiguacion.max),
  }));

  return congelarProfundo({
    seed: rng.seed,
    vinculos,
  });
}
