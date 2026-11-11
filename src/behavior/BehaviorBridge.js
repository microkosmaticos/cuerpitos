// ============================================================
// BehaviorBridge.js
//
// PUENTE entre el motor de comportamientos (reaccions.js) y la
// experiencia visual.
//
// Responsabilidades:
//   - dar de alta cada organismo cuando nace y darlo de baja cuando
//     desaparece (los ids del motor son los del organismo);
//   - avanzar el motor con un reloj inyectable (pruebas sin esperar);
//   - guardar la directiva activa de cada organismo con su progreso,
//     para que la vista la pueda animar;
//   - exponer la emoción actual, que el motor cambia al terminar un
//     evento con efectos.
//
// El motor no sabe dibujar y la vista no sabe de reglas: este puente
// es el único lugar donde se cruzan.
// ============================================================

import {
  BehaviorEngine,
  EVENTS,
  Reacciones,
  Weights,
} from "../../reaccions.js";
import { SocialPacer } from "./SocialPacer.js";

/** Pausa mínima entre decisiones, en ms (agent.md: "habrá pausas"). */
export const PAUSA_ENTRE_DECISIONES = 1400;

/**
 * Pesos de selección. No hace falta que sumen 1: se normalizan solos.
 * Los eventos de a dos pesan menos para que no dominen la escena.
 */
export const PESOS = Object.freeze({
  approach: 1.0,
  hug: 0.6,
  kiss: 0.5,
  punch: 0.45,
  reject: 0.4,
  euphoric_burst: 0.7,
  faint: 0.35,
  shake: 0.5,
  limb_stretch: 0.9,
});

export class BehaviorBridge {
  /**
   * @param {object} opciones
   * @param {Function} opciones.ahora reloj en ms (inyectable en pruebas)
   * @param {Function} opciones.random generador 0..1 (inyectable)
   * @param {object} opciones.pesos pesos por evento
   * @param {number} opciones.pausaMs pausa entre decisiones
   * @param {object} opciones.pacer ritmo social espontáneo (inyectable)
   */
  constructor({
    ahora = () => Date.now(),
    random = Math.random,
    pesos = PESOS,
    pausaMs = PAUSA_ENTRE_DECISIONES,
    pacer = null,
  } = {}) {
    this.ahora = ahora;

    this.system = new Reacciones();
    this.motor = new BehaviorEngine(this.system, {
      weights: new Weights(pesos),
      random,
      minGap: pausaMs,
    });

    this.pacer = pacer ?? new SocialPacer({ ahora, random });

    /** organismoId → { evento, inicio, duracion, partnerId } */
    this.activos = new Map();

    this.system.events.on("directive", (directiva) => {
      this.aplicarDirectiva(directiva);
    });
  }

  // ------------------------------------------------------------
  // Alta y baja
  // ------------------------------------------------------------

  /** El organismo nació: el motor empieza a considerarlo. */
  registrar(organismoId) {
    this.system.registerOrganism({ id: organismoId });
    if (!this.activos.has(organismoId)) this.activos.set(organismoId, null);
    return this;
  }

  /** El organismo desapareció: se limpia todo lo suyo. */
  darDeBaja(organismoId) {
    this.system.unregisterOrganism(organismoId);
    this.activos.delete(organismoId);
    return this;
  }

  /** Ids registrados (para pruebas y depuración). */
  organismos() {
    return [...this.system.organisms.keys()];
  }

  // ------------------------------------------------------------
  // Avance
  // ------------------------------------------------------------

  /**
   * Avanza el ánimo social y el motor. El motor decide como mucho una
   * vez por `pausaMs` y completa los eventos cuya duración venció.
   * @param {object} datos
   * @param {number|null} datos.distancia distancia entre las dos personas
   */
  update({ distancia = null } = {}) {
    this.pacer.update(this.system, { distancia });
    this.motor.update(this.ahora());
    return this;
  }

  // ------------------------------------------------------------
  // Lectura para la vista
  // ------------------------------------------------------------

  /**
   * Estado visual de un organismo:
   *   emocion       id de emoción del catálogo
   *   comportamiento id del evento activo, o null
   *   progreso      0..1 del evento activo
   *   parejaId      organismo con el que interactúa, o null
   */
  estadoDe(organismoId) {
    const organismo = this.system.getOrganism(organismoId);
    const activo = this.activos.get(organismoId) ?? null;

    let progreso = 0;
    if (activo) {
      const transcurrido = this.ahora() - activo.inicio;
      progreso = activo.duracion > 0
        ? Math.min(1, Math.max(0, transcurrido / activo.duracion))
        : 0;
    }

    return {
      emocion: organismo?.emotion ?? "neutral",
      comportamiento: activo?.evento ?? null,
      progreso,
      parejaId: activo?.partnerId ?? organismo?.partnerId ?? null,
    };
  }

  /** Emoción actual, sin el resto del estado. */
  emocionDe(organismoId) {
    return this.system.getOrganism(organismoId)?.emotion ?? "neutral";
  }

  // ------------------------------------------------------------
  // Directivas
  // ------------------------------------------------------------

  aplicarDirectiva(directiva) {
    if (!directiva || !directiva.organismId) return;

    const { organismId, behavior, phase, params } = directiva;

    if (phase === "start") {
      const duracion = Number.isFinite(params?.duration)
        ? params.duration
        : EVENTS[behavior]?.duration?.[0] ?? 1000;

      this.activos.set(organismId, {
        evento: behavior,
        inicio: this.ahora(),
        duracion,
        partnerId: params?.partnerId ?? null,
      });
      return;
    }

    if (phase === "end") {
      // La emoción ya la aplicó el motor antes de emitir esta directiva.
      this.activos.set(organismId, null);
    }
  }
}
