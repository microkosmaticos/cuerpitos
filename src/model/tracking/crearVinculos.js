// ============================================================
// crearVinculos.js
//
// VÍNCULO parte ↔ ancla de tracking, ANATÓMICO.
//
// El cuerpo del avatar tiene que seguir al cuerpo de la persona:
//   - un brazo del avatar sigue el CODO de su mismo lado;
//   - un antebrazo sigue la MUÑECA de su mismo lado;
//   - lo que no tiene par en el cuerpo (roles raros) sigue el
//     hombro de su lado.
//
// El lado se decide por la geometría de la parte dentro del avatar:
// si su centro está a la izquierda del centro del cuerpo, usa las
// anclas izquierdas de la imagen. Las coordenadas no se espejan
// (agent.md), así que "izquierda" es la izquierda de la imagen.
//
// El temperamento (ganancia, retraso, rigidez, amortiguación) sigue
// siendo propio de cada organismo y se sortea con una semilla
// derivada, así que dos avatares con la misma anatomía responden con
// ritmos distintos. Nada de esto altera el genoma ni la paleta.
//
// La cabeza y el núcleo NO reciben ancla: van rígidos con el torso.
// ============================================================

import { SeededRandom } from "../random/SeededRandom.js";
import { congelarProfundo } from "../families/deepFreeze.js";
import { CANTIDAD_DE_ANCLAS } from "./TrackingFrame.js";

// Constante fija para derivar la semilla de los vínculos.
const CONSTANTE_DE_VINCULOS = 0x27d4eb2f;

/**
 * Ancla de cada lado de la imagen, por rol.
 * Orden del contrato: 0 hombro izq · 1 hombro der · 2 codo izq ·
 * 3 codo der · 4 muñeca izq · 5 muñeca der · 6 cintura.
 */
const ANCLAS_POR_ROL = congelarProfundo({
  brazo: [2, 3], // el brazo (hombro→codo) sigue el codo
  antebrazo: [4, 5], // el antebrazo (codo→mano) sigue la muñeca
});

/** Roles sin par anatómico: siguen el hombro de su lado. */
const ANCLAS_POR_DEFECTO = [0, 1];

/**
 * Rangos del temperamento. Están pensados para que el organismo
 * responda, pero NUNCA copie el movimiento humano de forma literal:
 *   - ganancia 0.35–0.8: el ángulo es una fracción del desvío
 *   - retraso 0.06–0.22 s: se nota el arrastre sin quedar desconectado
 *   - rigidez 6–14: vuelve al reposo en menos de un segundo
 *   - amortiguación 0.85–1.15 del crítico: no oscila
 */
export const TEMPERAMENTO = congelarProfundo({
  ganancia: { min: 0.35, max: 0.8 },
  retraso: { min: 0.06, max: 0.22 },
  rigidez: { min: 6, max: 14 },
  amortiguacion: { min: 0.85, max: 1.15 },
});

/**
 * @param {object} shape forma ya construida (partes con rol y puntos)
 * @param {number|string} seed semilla del organismo
 */
export function crearVinculos(shape, seed) {
  const rng = new SeededRandom((Number(seed) ^ CONSTANTE_DE_VINCULOS) >>> 0);

  // Centro del cuerpo del avatar: se usa solo para decidir el lado.
  const centro = centroDelCuerpo(shape.parts);

  // La cabeza va rígida con el torso: no participa del tracking.
  const moviles = shape.parts.filter(
    (parte) => parte.role !== "nucleo" && parte.role !== "cabeza"
  );

  // Cuántas partes ya eligieron cada ancla (para repartir fases).
  const usos = new Map();

  const vinculos = moviles.map((parte) => {
    const ancla = anclaDeLaParte(parte, centro);

    const uso = usos.get(ancla) ?? 0;
    usos.set(ancla, uso + 1);

    return {
      partId: parte.id,
      ancla,
      // Varias partes sobre la misma ancla se desfasan entre sí.
      fase: uso,
      ganancia: rng.range(TEMPERAMENTO.ganancia.min, TEMPERAMENTO.ganancia.max),
      retraso: rng.range(TEMPERAMENTO.retraso.min, TEMPERAMENTO.retraso.max),
      rigidez: rng.range(TEMPERAMENTO.rigidez.min, TEMPERAMENTO.rigidez.max),
      amortiguacion: rng.range(
        TEMPERAMENTO.amortiguacion.min,
        TEMPERAMENTO.amortiguacion.max
      ),
    };
  });

  return congelarProfundo({
    seed: rng.seed,
    vinculos,
  });
}

// ------------------------------------------------------------
// Ayudas
// ------------------------------------------------------------

/** Ancla del contrato que le corresponde a una parte, por rol y lado. */
function anclaDeLaParte(parte, centro) {
  const lado = ladoDeLaParte(parte, centro);
  const porRol = ANCLAS_POR_ROL[parte.role] ?? ANCLAS_POR_DEFECTO;

  const ancla = porRol[lado];
  return ancla >= 0 && ancla < CANTIDAD_DE_ANCLAS ? ancla : ANCLAS_POR_DEFECTO[lado];
}

/** 0 = lado izquierdo de la imagen, 1 = derecho. */
function ladoDeLaParte(parte, centro) {
  const puntos = parte.points ?? [];
  if (puntos.length === 0) return 0;

  const x = puntos.reduce((suma, punto) => suma + punto.x, 0) / puntos.length;
  return x < centro.x ? 0 : 1;
}

/** Centro del cuerpo: promedio de todos los puntos de todas las partes. */
function centroDelCuerpo(partes) {
  let sumaX = 0;
  let sumaY = 0;
  let cantidad = 0;

  for (const parte of partes) {
    for (const punto of parte.points ?? []) {
      sumaX += punto.x;
      sumaY += punto.y;
      cantidad += 1;
    }
  }

  if (cantidad === 0) return { x: 0, y: 0 };
  return { x: sumaX / cantidad, y: sumaY / cantidad };
}
