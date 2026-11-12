// ============================================================
// TrackingAdapter.js
//
// PUENTE entre el tracking real (ml5 bodyPose + ParticipantTracker) y
// el contrato de datos del modelo (TrackingFrame).
//
// El modelo y la pose no saben de ml5, de píxeles ni de confianza:
// reciben exactamente el frame de 7 anclas normalizadas. Acá se hace
// esa conversión, y solo acá:
//
//   participantes (px, ids estables)  ──►  frame (0..1, sin espejo)
//
// Reglas:
//   - se toman como máximo dos personas (lo garantiza el contrato);
//   - "present" es true solo mientras el participante está ACTIVE;
//   - la energía sale del MOVIMIENTO REAL de los anclas (gestos y
//     desplazamiento), con zona muerta y suavizado: quieto = 0;
//   - las coordenadas no se espejan nunca (agent.md).
// ============================================================

import {
  CANTIDAD_DE_ANCLAS,
  CONFIANZA_MINIMA,
  validarFrame,
} from "../model/tracking/TrackingFrame.js";

/** Nombre de keypoint de MoveNet para cada ancla, en el orden fijo. */
const NOMBRES_DE_ANCLAS = [
  ["left_shoulder"],
  ["right_shoulder"],
  ["left_elbow"],
  ["right_elbow"],
  ["left_wrist"],
  ["right_wrist"],
  ["left_hip", "right_hip"], // la cintura es el promedio de las caderas
];

/**
 * Movimiento que se considera energía 1, en unidades normalizadas por
 * segundo. Un gesto amplio (0,3 del encuadre en medio segundo) llega
 * al máximo; el temblor del detector queda por debajo de la zona muerta.
 */
const ENERGIA_MAXIMA = 0.18;

/** Debajo de este movimiento no hay energía (ruido del detector). */
const ZONA_MUERTA = 0.012;

/** Suavizado de la energía, en segundos: la señal no salta de golpe. */
const SUAVIZADO = 0.18;

/** Ancho de hombros que se considera "pose completamente abierta". */
const SEPARACION_ABIERTA = 0.35;

export class TrackingAdapter {
  /**
   * @param {object} opciones
   * @param {number} opciones.ancho ancho del video en píxeles
   * @param {number} opciones.alto alto del video en píxeles
   */
  constructor({ ancho = 640, alto = 480 } = {}) {
    this.setFrameSize(ancho, alto);

    /** Último estado conocido por participante (para velocidades y energía). */
    this.memoria = new Map();
  }

  setFrameSize(ancho, alto) {
    this.ancho = Math.max(1, ancho || 1);
    this.alto = Math.max(1, alto || 1);
  }

  /**
   * Convierte el resultado del ParticipantTracker en un frame válido.
   * @param {{participants: object[], ignored?: object[], session?: string}} resultado
   * @param {number} ahora timestamp en ms (el mismo reloj que usa el tracker)
   * @returns {object} frame congelado y validado
   */
  update(resultado, ahora = 0) {
    const participantes = Array.isArray(resultado?.participants)
      ? resultado.participants.slice(0, 2)
      : [];

    const persons = participantes.map((participante) =>
      this.convertir(participante, ahora)
    );

    // Se olvidan los que ya no están: no crece la memoria sin límite.
    const vivos = new Set(participantes.map((p) => p.participantId));
    for (const id of [...this.memoria.keys()]) {
      if (!vivos.has(id)) this.memoria.delete(id);
    }

    return validarFrame({ timestamp: ahora, persons });
  }

  // ------------------------------------------------------------
  // Una persona
  // ------------------------------------------------------------

  convertir(participante, ahora) {
    const id = participante?.participantId ?? `slot${participante?.slotId ?? 0}`;
    const presente = participante?.state === "ACTIVE";

    const pose = participante?.pose ?? null;
    const anterior = this.memoria.get(id) ?? null;
    const dt =
      anterior && Number.isFinite(anterior.ahora) && ahora > anterior.ahora
        ? (ahora - anterior.ahora) / 1000
        : 0;

    const anclas = this.leerAnclas(pose);
    const velocidades = this.calcularVelocidades(anclas, anterior, dt);

    const centro = this.normalizarPunto(participante?.center) ?? {
      x: 0.5,
      y: 0.5,
    };

    const movimiento = this.medirMovimiento(anclas, velocidades, dt);
    const energiaAnterior = anterior?.energia ?? 0;
    const alfa = dt > 0 ? 1 - Math.exp(-dt / SUAVIZADO) : 0;
    const energia = presente
      ? energiaAnterior + (movimiento - energiaAnterior) * alfa
      : 0;

    const registro = {
      ahora,
      anclas: presente ? anclas : new Array(CANTIDAD_DE_ANCLAS).fill(null),
      energia: Math.min(1, Math.max(0, energia)),
    };
    this.memoria.set(id, registro);

    return {
      id,
      present: presente,
      confidence: presente ? this.confianzaDe(pose) : 0,
      center: centro,
      energy: registro.energia,
      spread: this.medirApertura(anclas),
      anchors: presente
        ? anclas.map((ancla, indice) => this.armarAncla(ancla, velocidades[indice]))
        : new Array(CANTIDAD_DE_ANCLAS).fill(null),
    };
  }

  /** Keypoint normalizado de cada ancla, o null si no es confiable. */
  leerAnclas(pose) {
    if (!pose || typeof pose.get !== "function") {
      return new Array(CANTIDAD_DE_ANCLAS).fill(null);
    }

    return NOMBRES_DE_ANCLAS.map((nombres) => {
      const puntos = nombres
        .map((nombre) => pose.get(nombre))
        .filter((punto) => punto && (punto.confidence ?? 0) >= CONFIANZA_MINIMA);

      if (puntos.length === 0) return null;

      const totalPeso = puntos.reduce(
        (suma, punto) => suma + (punto.confidence ?? 0),
        0
      ) || 1;

      return {
        x: puntos.reduce((suma, p) => suma + p.x * (p.confidence ?? 0), 0) / totalPeso,
        y: puntos.reduce((suma, p) => suma + p.y * (p.confidence ?? 0), 0) / totalPeso,
        confidence:
          puntos.reduce((suma, p) => suma + (p.confidence ?? 0), 0) / puntos.length,
      };
    }).map((punto) => (punto ? this.normalizarPunto(punto) : null));
  }

  /**
   * Velocidad de cada ancla contra la lectura anterior, en unidades
   * normalizadas por segundo. Sin lectura anterior o sin tiempo, 0.
   */
  calcularVelocidades(anclas, anterior, dt) {
    const quieta = { vx: 0, vy: 0, modulo: 0 };

    return anclas.map((ancla, indice) => {
      if (!anterior || !(dt > 0)) return quieta;

      const previa = anterior.anclas?.[indice] ?? null;
      if (!ancla || !previa) return quieta;

      const vx = (ancla.x - previa.x) / dt;
      const vy = (ancla.y - previa.y) / dt;
      return { vx, vy, modulo: Math.hypot(vx, vy) };
    });
  }

  /**
   * Energía cruda 0..1 a partir del movimiento de los anclas.
   *
   * Se mezcla la media con el máximo: si la persona mueve solo un brazo,
   * la media de las 7 anclas se diluye y el gesto se perdería. Mitad y
   * mitad mantiene la calma cuando todo está quieto y reacciona cuando
   * una sola extremidad se mueve.
   */
  medirMovimiento(anclas, velocidades, dt) {
    if (!(dt > 0)) return 0;

    let suma = 0;
    let cantidad = 0;
    let maximo = 0;

    velocidades.forEach((velocidad, indice) => {
      if (!anclas[indice]) return;
      suma += velocidad.modulo;
      if (velocidad.modulo > maximo) maximo = velocidad.modulo;
      cantidad += 1;
    });

    if (cantidad === 0) return 0;

    const media = suma / cantidad;
    const movimiento = media * 0.5 + maximo * 0.5;

    if (movimiento <= ZONA_MUERTA) return 0;

    return Math.min(
      1,
      (movimiento - ZONA_MUERTA) / (ENERGIA_MAXIMA - ZONA_MUERTA)
    );
  }

  /** Apertura de la pose según el ancho de hombros (0..1). */
  medirApertura(anclas) {
    const izquierdo = anclas[0];
    const derecho = anclas[1];
    if (!izquierdo || !derecho) return 0.5;

    const separacion = Math.hypot(derecho.x - izquierdo.x, derecho.y - izquierdo.y);
    const relacion = Math.min(1, Math.max(0, separacion / SEPARACION_ABIERTA));
    return 0.35 + relacion * 0.65;
  }

  /** Confianza general de la persona: promedio de keypoints de la pose. */
  confianzaDe(pose) {
    if (!pose) return 0;
    if (Number.isFinite(pose.score)) return Math.min(1, Math.max(0, pose.score));

    const puntos = (pose.keypoints ?? []).filter((punto) =>
      Number.isFinite(punto.confidence ?? punto.score)
    );
    if (puntos.length === 0) return 0;

    return (
      puntos.reduce((suma, p) => suma + (p.confidence ?? p.score ?? 0), 0) /
      puntos.length
    );
  }

  // ------------------------------------------------------------
  // Ayudas
  // ------------------------------------------------------------

  /** Pasa un punto de píxeles del video a 0..1. */
  normalizarPunto(punto) {
    if (!punto || !Number.isFinite(punto.x) || !Number.isFinite(punto.y)) {
      return null;
    }

    return {
      x: punto.x / this.ancho,
      y: punto.y / this.alto,
      confidence: Number.isFinite(punto.confidence) ? punto.confidence : 0,
    };
  }

  armarAncla(ancla, velocidad) {
    if (!ancla) return null;

    return {
      x: ancla.x,
      y: ancla.y,
      vx: Math.min(1, Math.max(-1, velocidad?.vx ?? 0)),
      vy: Math.min(1, Math.max(-1, velocidad?.vy ?? 0)),
      confidence: ancla.confidence,
    };
  }
}
