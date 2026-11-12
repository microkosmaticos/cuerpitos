// ============================================================
// TrackingFrame.js
//
// EL CONTRATO de datos del tracking. Es lo único que la capa de
// entrada tiene que producir y lo único que el modelo consume.
//
// SISTEMA DE COORDENADAS
//   - x e y van de 0 a 1 (normalizadas, no píxeles).
//   - El origen (0, 0) está ARRIBA A LA IZQUIERDA.
//   - La imagen NO se espeja: la izquierda de la pantalla es la
//     izquierda de la IMAGEN de la cámara, no la izquierda de la
//     persona. Si la persona levanta su mano derecha, aparece del
//     lado izquierdo de la imagen y se reporta como "izquierda".
//     Todo el contrato usa esta convención, sin excepciones.
//
// ORDEN FIJO DE LOS ANCHORS (7 posiciones)
//   Los lados son SIEMPRE "izquierdo/derecho DE LA IMAGEN"
//   (coordenadas sin espejo), nunca de la persona.
//   0 hombro izquierdo de la imagen
//   1 hombro derecho de la imagen
//   2 codo izquierdo de la imagen
//   3 codo derecho de la imagen
//   4 muñeca izquierda de la imagen
//   5 muñeca derecha de la imagen
//   6 cintura (centro entre las caderas)
//
// Quien desarrolle el tracking solo tiene que llenar esos números.
// El organismo NO usa estos nombres: sus partes tienen anclas
// abstractas 0..6 y el vínculo se decide al nacer.
//
// CANALES DE CADA PERSONA
//   id          texto estable: sirve para emparejar organismo y persona
//   present     si la persona está en cuadro
//   confidence  0..1, qué tan segura es la detección
//   center      centro del cuerpo en 0..1
//   energy      0..1, cuánto se está moviendo
//   spread      0..1, qué tan abierta está la pose
//
// CANALES DE CADA ANCHOR
//   x, y        0..1
//   vx, vy      velocidad normalizada (-1..1); puede faltar
//   confidence  0..1; por debajo de CONFIANZA_MINIMA el anchor se
//               descarta y queda en null
// ============================================================

import { congelarProfundo } from "../families/deepFreeze.js";

/** Cuántos anchors tiene el contrato. */
export const CANTIDAD_DE_ANCLAS = 7;

/** Cuántas personas se aceptan como máximo. */
export const MAXIMO_DE_PERSONAS = 2;

/** Debajo de esta confianza, el anchor no se usa. */
export const CONFIANZA_MINIMA = 0.2;

/** Nombres del orden fijo. Es documentación para quien hace el tracking. */
// Es EXACTAMENTE el mismo orden que la lista de arriba; acá va como
// identificadores para que el código y el panel de depuración los usen.
export const ORDEN_DE_ANCLAS = congelarProfundo([
  "hombro-izquierdo",
  "hombro-derecho",
  "codo-izquierdo",
  "codo-derecho",
  "muneca-izquierda",
  "muneca-derecha",
  "cintura",
]);

function acotar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Número finito acotado, o el valor por defecto. */
function numeroAcotado(valor, minimo, maximo, porDefecto) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return porDefecto;
  return acotar(valor, minimo, maximo);
}

function validarPunto(punto, porDefecto) {
  if (!punto || typeof punto !== "object") return porDefecto;
  return {
    x: numeroAcotado(punto.x, 0, 1, porDefecto.x),
    y: numeroAcotado(punto.y, 0, 1, porDefecto.y),
  };
}

function validarAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") return null;

  const x = numeroAcotado(anchor.x, 0, 1, undefined);
  const y = numeroAcotado(anchor.y, 0, 1, undefined);
  if (x === undefined || y === undefined) return null;

  const confidence = numeroAcotado(anchor.confidence, 0, 1, 0);
  if (confidence < CONFIANZA_MINIMA) return null;

  return {
    x,
    y,
    vx: numeroAcotado(anchor.vx, -1, 1, 0),
    vy: numeroAcotado(anchor.vy, -1, 1, 0),
    confidence,
  };
}

function validarPersona(persona, indice) {
  if (!persona || typeof persona !== "object") return null;

  const id =
    typeof persona.id === "string" && persona.id.length > 0
      ? persona.id
      : `p${indice}`;

  const anchorsOriginales = Array.isArray(persona.anchors) ? persona.anchors : [];
  const anchors = [];

  for (let i = 0; i < CANTIDAD_DE_ANCLAS; i++) {
    anchors.push(validarAnchor(anchorsOriginales[i]));
  }

  return {
    id,
    present: persona.present !== false,
    confidence: numeroAcotado(persona.confidence, 0, 1, 0),
    center: validarPunto(persona.center, { x: 0.5, y: 0.5 }),
    energy: numeroAcotado(persona.energy, 0, 1, 0),
    spread: numeroAcotado(persona.spread, 0, 1, 0),
    anchors,
  };
}

/**
 * Valida y limpia un frame.
 *
 * - descarta NaN e Infinity
 * - recorta todo a su rango (0..1, velocidades -1..1)
 * - convierte en null los anchors faltantes o de baja confianza
 * - corta a las personas extra (máximo 2)
 *
 * Siempre devuelve un frame válido y congelado.
 */
export function validarFrame(frame) {
  if (!frame || typeof frame !== "object") {
    return congelarProfundo({ timestamp: 0, persons: [] });
  }

  const timestamp = numeroAcotado(frame.timestamp, 0, Number.MAX_SAFE_INTEGER, 0);
  const personasOriginales = Array.isArray(frame.persons) ? frame.persons : [];

  const persons = [];
  for (const persona of personasOriginales.slice(0, MAXIMO_DE_PERSONAS)) {
    const validada = validarPersona(persona, persons.length);
    if (validada) persons.push(validada);
  }

  return congelarProfundo({ timestamp, persons });
}

/** Frame sin personas: útil para arrancar antes del primer dato. */
export function frameVacio(timestamp = 0) {
  return congelarProfundo({ timestamp, persons: [] });
}
