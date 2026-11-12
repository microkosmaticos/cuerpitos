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
import {
  DISTANCIA_CERCANA,
  SocialPacer,
} from "./SocialPacer.js";

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

    /** El primer encuentro de cada pareja se provoca una sola vez. */
    this.encuentroHecho = false;

    /** Reacción que remata el encuentro: abrazo o golpe. */
    this.remate = null;

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

    // Con la pareja desarmada, la próxima vez que haya dos vuelve el encuentro.
    this.encuentroHecho = false;
    this.remate = null;
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

    // En cuanto están los dos organismos, el encuentro no espera al azar.
    // Va antes del motor para que ninguna decisión aleatoria se le adelante.
    this.provocarEncuentro(distancia);

    // Apenas la pareja queda libre, la reacción del encuentro se ejecuta.
    this.intentarRemate();

    this.motor.update(this.ahora());
    return this;
  }

  // ------------------------------------------------------------
  // Primer encuentro
  // ------------------------------------------------------------

  /**
   * Dispara el primer encuentro de la pareja apenas están los dos
   * organismos: fija la relación según la distancia real entre las
   * personas, prepara la emoción y arranca `approach` en el acto.
   *
   * Sin esto, la primera interacción dependía de dos sorteos del ritmo
   * social (emoción y relación) y podía tardar muchos segundos.
   *
   * @param {number|null} distancia distancia normalizada entre personas
   * @returns {boolean} true si el encuentro arrancó
   */
  provocarEncuentro(distancia = null) {
    if (this.encuentroHecho) return false;

    const ids = this.organismos();
    if (ids.length < 2) return false;

    const ahora = this.ahora();
    const [a, b] = ids.map((id) => this.system.getOrganism(id));
    if (!a || !b) return false;

    // Si alguno está ocupado, se reintenta en el próximo cuadro.
    if (!a.canAct(ahora) || !b.canAct(ahora)) return false;

    // Cerca tiende al amor; lejos, al conflicto (misma regla del ritmo social).
    const cerca = distancia !== null && distancia < DISTANCIA_CERCANA;
    const relacion = cerca ? "mutual_love" : "conflict";
    this.system.setRelationship(a.id, b.id, relacion, ahora);

    // Un organismo atraído habilita el abrazo; el conflicto habilita el golpe.
    if (relacion === "mutual_love") {
      a.setEmotion("attracted");
      b.setEmotion("neutral");
    }

    const arranco = this.motor.provocar("approach", [a, b], ahora);
    if (!arranco) {
      // Deshacer lo preparado: se reintenta con la pareja libre.
      this.system.setRelationship(a.id, b.id, null, ahora);
      return false;
    }

    this.encuentroHecho = true;

    // La reacción del encuentro queda agendada: abrazo si hay amor,
    // golpe si hay conflicto. Se ejecuta apenas la pareja queda libre.
    this.remate = {
      evento: relacion === "mutual_love" ? "hug" : "punch",
      limite: ahora + 8000,
    };

    // Que la reacción siguiente pueda encadenarse apenas termine el acercamiento.
    const duracion = a.activeEvent?.duration ?? EVENTS.approach.duration[0];
    this.motor._nextDecisionAt = ahora + duracion + 1;

    return true;
  }

  /**
   * Ejecuta la reacción agendada del encuentro (abrazo o golpe) apenas
   * los dos organismos pueden actuar: sin evento activo y sin cooldown.
   * Reintenta cada cuadro hasta el límite, después deja seguir al azar.
   *
   * @returns {boolean} true si la reacción arrancó
   */
  intentarRemate() {
    if (!this.remate) return false;

    const ahora = this.ahora();
    if (ahora > this.remate.limite) {
      this.remate = null;
      return false;
    }

    const ids = this.organismos();
    if (ids.length < 2) {
      this.remate = null;
      return false;
    }

    const [a, b] = ids.map((id) => this.system.getOrganism(id));
    const arranco = this.motor.provocar(this.remate.evento, [a, b], ahora);
    if (arranco) this.remate = null;

    return arranco;
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

      // El catálogo declara la extremidad autónoma como parte del estado:
      // `limb_stretch` la ocupa mientras dura el evento.
      const organismo = this.system.getOrganism(organismId);
      if (organismo) {
        organismo.autonomousLimb = behavior === "limb_stretch" ? "leftArm" : null;
      }
      return;
    }

    if (phase === "end") {
      // La emoción ya la aplicó el motor antes de emitir esta directiva.
      this.activos.set(organismId, null);

      const organismo = this.system.getOrganism(organismId);
      if (organismo) organismo.autonomousLimb = null;
    }
  }
}
