// ============================================================
// SocialPacer.js
//
// RITMO SOCIAL ESPONTÁNEO.
//
// El catálogo de reacciones exige un estado previo para casi todos
// los eventos individuales (euforia antes de la explosión, mareo
// antes del desmayo) y una relación previa para los eventos de a dos
// (abrazo y beso piden "mutual_love"; golpe y rechazo piden
// "conflict"). El archivo de reacciones documenta esa capa como
// "extensión futura": transiciones espontáneas y scheduling.
//
// Este módulo la implementa sin tocar el catálogo:
//   - cada tanto cambia la emoción de un organismo (respetando las
//     restricciones del catálogo),
//   - si hay dos organismos, a veces crea una relación (amor o
//     conflicto) según la distancia entre las personas, y a veces la
//     disuelve.
//
// Con eso el motor de comportamientos ya tiene de dónde elegir y las
// interacciones de la sección 7 de agent.md pueden ocurrir.
// ============================================================

import {
  EMOTIONS,
  areIncompatible,
} from "../../reaccions.js";

/**
 * Emociones que pueden aparecer solas. "fainted" queda afuera a
 * propósito: solo se llega desmayado por el evento `faint`.
 */
export const EMOCIONES_ESPONTANEAS = Object.freeze([
  "neutral",
  "shy",
  "attracted",
  "lovestruck",
  "euphoric",
  "nauseous",
]);

/** Relaciones posibles entre dos organismos. */
export const RELACIONES = Object.freeze(["mutual_love", "conflict"]);

/** Cada cuánto se revisa el ánimo, en ms. */
export const CADA_MS = 6000;

/** Variación del intervalo (0.4 = ±40 %). */
export const JITTER = 0.4;

/** Probabilidad de cambiar la emoción en cada revisión. */
export const PROBABILIDAD_EMOCION = 0.55;

/** Probabilidad de crear una relación cuando no hay ninguna. */
export const PROBABILIDAD_RELACION = 0.6;

/** Probabilidad de disolver una relación existente. */
export const PROBABILIDAD_CORTE = 0.3;

/** Probabilidad de amor mutuo cuando las personas están cerca. */
export const PROBABILIDAD_AMOR_CERCA = 0.75;

/** Probabilidad de amor mutuo cuando están lejos (casi siempre conflicto). */
export const PROBABILIDAD_AMOR_LEJOS = 0.15;

/**
 * Distancia (normalizada) por debajo de la cual las personas están
 * "cerca" y el vínculo tiende al amor en vez del conflicto.
 */
export const DISTANCIA_CERCANA = 0.45;

export class SocialPacer {
  /**
   * @param {object} opciones
   * @param {Function} opciones.ahora reloj en ms
   * @param {Function} opciones.random generador 0..1
   * @param {number} opciones.cadaMs intervalo base entre revisiones
   */
  constructor({
    ahora = () => Date.now(),
    random = Math.random,
    cadaMs = CADA_MS,
  } = {}) {
    this.ahora = ahora;
    this.random = random;
    this.cadaMs = cadaMs;

    this.proximaVez = 0;
  }

  /**
   * Avanza el ánimo social.
   * @param {object} system instancia de Reacciones
   * @param {object} datos
   * @param {number|null} datos.distancia distancia normalizada entre personas
   */
  update(system, { distancia = null } = {}) {
    const ahora = this.ahora();
    if (ahora < this.proximaVez) return this;

    this.proximaVez = ahora + this.cadaMs * (1 + (this.random() * 2 - 1) * JITTER);

    this.cambiarEmociones(system);
    this.actualizarRelacion(system, distancia, ahora);

    return this;
  }

  // ------------------------------------------------------------
  // Emociones
  // ------------------------------------------------------------

  cambiarEmociones(system) {
    for (const organismo of system.organisms.values()) {
      // El motor no deja cambiar la emoción durante un evento activo.
      if (organismo.hasActiveEvent()) continue;
      if (this.random() > PROBABILIDAD_EMOCION) continue;

      const opciones = EMOCIONES_ESPONTANEAS.filter(
        (emocion) =>
          emocion !== organismo.emotion &&
          !areIncompatible(EMOTIONS, organismo.emotion, emocion)
      );

      if (opciones.length === 0) continue;

      organismo.setEmotion(this.elegir(opciones));
    }
  }

  // ------------------------------------------------------------
  // Relaciones
  // ------------------------------------------------------------

  actualizarRelacion(system, distancia, ahora) {
    const ids = [...system.organisms.keys()];
    if (ids.length < 2) return;

    const [a, b] = ids;
    const actual = system.getRelationship(a, b);

    if (actual === null) {
      if (this.random() > PROBABILIDAD_RELACION) return;

      // Cerca tiende al amor; lejos, al conflicto.
      const cerca = distancia !== null && distancia < DISTANCIA_CERCANA;
      const amor = this.random() < (cerca ? PROBABILIDAD_AMOR_CERCA : PROBABILIDAD_AMOR_LEJOS);
      system.setRelationship(a, b, amor ? "mutual_love" : "conflict", ahora);
      return;
    }

    if (this.random() < PROBABILIDAD_CORTE) {
      system.setRelationship(a, b, null);
    }
  }

  // ------------------------------------------------------------
  // Ayudas
  // ------------------------------------------------------------

  elegir(opciones) {
    const indice = Math.min(
      opciones.length - 1,
      Math.max(0, Math.floor(this.random() * opciones.length))
    );
    return opciones[indice];
  }
}
