// ============================================================
// puedeNacer.js
//
// Condición PURA de "persona válida". No cambia nada: solo responde
// sí o no. Los umbrales viven en src/config/ciclo.js.
//
// Se exige:
//   - que esté presente,
//   - confianza general suficiente,
//   - los dos hombros (anclas 0 y 1) con confianza suficiente,
//   - el centro dentro de un margen del encuadre,
//   - separación mínima entre hombros (indica que está de frente).
//
// Las coordenadas son 0..1, origen arriba-izquierda, sin espejo.
// ============================================================

import { CICLO } from "../../config/ciclo.js";

/**
 * @param {object|null} persona persona del frame de tracking
 * @param {object} config configuración del ciclo
 * @returns {boolean}
 */
export function puedeNacer(persona, config = CICLO) {
  if (!persona || !persona.present) return false;

  const umbrales = config.presencia;

  if (!(persona.confidence >= umbrales.confianzaMinima)) return false;

  const anchors = persona.anchors ?? [];
  const hombroIzquierdo = anchors[0];
  const hombroDerecho = anchors[1];

  if (!hombroIzquierdo || !hombroDerecho) return false;
  if (hombroIzquierdo.confidence < umbrales.confianzaHombro) return false;
  if (hombroDerecho.confidence < umbrales.confianzaHombro) return false;

  const centro = persona.center;
  if (centro.x < umbrales.margenX.min || centro.x > umbrales.margenX.max) return false;
  if (centro.y < umbrales.margenY.min || centro.y > umbrales.margenY.max) return false;

  const separacion = Math.abs(hombroDerecho.x - hombroIzquierdo.x);
  if (separacion < umbrales.separacionHombros) return false;

  return true;
}
