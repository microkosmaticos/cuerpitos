/**
 * reaccions.js — Módulo de comportamientos e interacciones (proyecto Cuerpitos).
 *
 * Responsable de las emociones, los estados de relación y los eventos de los
 * organismos. Es independiente de la representación visual: se comunica con
 * bodies.js mediante directivas semánticas (ver `Reacciones.emitDirective`).
 *
 * Estructura:
 *   1. Catálogo declarativo: EMOTIONS, RELATIONSHIPS, EVENTS.
 *   2. OrganismState: estado mutable de un único organismo.
 *   3. Emitter: bus de eventos mínimo para desacoplar módulos.
 *   4. Reacciones: contenedor del sistema (organismos + relaciones + bus).
 *
 * Extensión futura (sin rehacer este archivo): probabilidades configurables,
 * transiciones espontáneas/reactivas, movimientos autónomos y scheduling.
 */
'use strict';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Congela en profundidad objetos y arrays para dejar el catálogo inmutable. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// ---------------------------------------------------------------------------
// 1. Catálogo declarativo
// ---------------------------------------------------------------------------
//
// Campos comunes a toda entrada:
//   id            string               identificador estable (en inglés).
//   type          string               'emotion' | 'relationship' | 'event'.
//   participants  number               organismos necesarios (1 o 2).
//   description   string               qué es.
//   triggers      string               cuándo se activa (legible por humanos).
//   restrictions  string[]             ids incompatibles (del mismo catálogo).
//   effects       string[]             ids que produce al ejecutarse (opcional).
//
// Campos exclusivos de las emociones:
//   blocksActions boolean              si true, impide iniciar eventos mientras
//                                      se mantiene esta emoción (p. ej. fainted).
//
// Campos exclusivos de los eventos:
//   duration      [number, number]     rango de duración en ms (mínimo, máximo).
//   conditions    (ctx) => boolean     precondición ejecutable.
//   recoversFrom  string[]             emociones bloqueantes de las que este
//                                      evento recupera (p. ej. shake → fainted).
//
// Semántica de `restrictions`: declara exclusión mutua (eventos o estados que
// no pueden coincidir en el tiempo) y se consulta de forma simétrica con
// `areIncompatible()`. Para los eventos, una restricción solo impide que dos
// acciones ocurran a la vez; NO bloquea secuencias (p. ej. approach → hug es
// una secuencia válida). El bloqueo de un organismo ocupado o desmayado no se
// expresa como restricción, sino mediante su disponibilidad y su emoción.
//
// Nota sobre emociones: hoy cada organismo tiene UNA emoción principal (ver
// OrganismState.emotion). Las `restrictions` son datos consultables, no una
// prohibición arquitectónica: si en el futuro se quieren emociones simultáneas
// o combinadas, se cambia la representación del estado sin rehacer el catálogo.

const EMOTIONS = deepFreeze({
  neutral: {
    id: 'neutral',
    type: 'emotion',
    participants: 1,
    description: 'Estado base, sin emoción dominante.',
    triggers: 'Por defecto cuando no hay otra emoción ni evento activo.',
    restrictions: [],
  },

  shy: {
    id: 'shy',
    type: 'emotion',
    participants: 1,
    description: 'Tímido: retraído y poco dispuesto a iniciar interacción.',
    triggers: 'Acercamiento de otro organismo, o aparición espontánea con otro presente.',
    restrictions: ['euphoric', 'attracted'],
  },

  attracted: {
    id: 'attracted',
    type: 'emotion',
    participants: 1,
    description: 'Atraído: muestra interés hacia el otro organismo.',
    triggers: 'Proximidad con otro organismo y acercamiento.',
    restrictions: ['shy', 'nauseous', 'fainted'],
  },

  lovestruck: {
    id: 'lovestruck',
    type: 'emotion',
    participants: 1,
    description: 'Enamorado unilateral: atracción sostenida sin reciprocidad.',
    triggers: 'Atracción mantenida sin que el otro corresponda.',
    restrictions: [],
  },

  euphoric: {
    id: 'euphoric',
    type: 'emotion',
    participants: 1,
    description: 'Eufórico: exaltado y expansivo.',
    triggers: 'Enamoramiento mutuo confirmado o tras una explosión eufórica.',
    restrictions: ['shy', 'nauseous', 'fainted'],
  },

  nauseous: {
    id: 'nauseous',
    type: 'emotion',
    participants: 1,
    description: 'Nauseabundo: mareado o con sensación de rechazo.',
    triggers: 'Tras un rechazo o conflicto, o de forma espontánea.',
    restrictions: ['attracted', 'euphoric'],
  },

  fainted: {
    id: 'fainted',
    type: 'emotion',
    participants: 1,
    description: 'Desmayado: inconsciente de forma temporal.',
    triggers: 'Resultado del evento de desmayo.',
    restrictions: ['attracted', 'euphoric'],
    blocksActions: true,
  },
});

const RELATIONSHIPS = deepFreeze({
  mutual_love: {
    id: 'mutual_love',
    type: 'relationship',
    participants: 2,
    description: 'Enamoramiento mutuo: ambos organismos se corresponden.',
    triggers: 'Ambos organismos con emoción compatible (atraído o enamorado).',
    restrictions: ['conflict'],
  },

  conflict: {
    id: 'conflict',
    type: 'relationship',
    participants: 2,
    description: 'Conflicto: antagonismo entre ambos organismos.',
    triggers: 'Rechazo, puñetazo o emociones incompatibles.',
    restrictions: ['mutual_love'],
  },
});

// Predicados auxiliares reutilizables en las precondiciones de eventos.
function isAttracted(state) {
  return Boolean(state) && (state.emotion === 'attracted' || state.emotion === 'lovestruck');
}

function isUnreceptive(state) {
  return Boolean(state) &&
    (state.emotion === 'shy' || state.emotion === 'neutral' || state.emotion === 'nauseous');
}

const EVENTS = deepFreeze({
  approach: {
    id: 'approach',
    type: 'event',
    participants: 2,
    description: 'Acercamiento: un organismo se aproxima al otro.',
    triggers: 'Dos organismos presentes, con emociones compatibles (ninguno desmayado).',
    duration: [1000, 2000],
    conditions: (ctx) =>
      ctx.other !== null &&
      ctx.self.emotion !== 'fainted' &&
      ctx.other.emotion !== 'fainted',
    restrictions: ['punch'],
  },

  hug: {
    id: 'hug',
    type: 'event',
    participants: 2,
    description: 'Abrazo entre ambos organismos.',
    triggers: 'Al menos uno atraído y ambos disponibles.',
    duration: [3000, 6000],
    conditions: (ctx) =>
      ctx.other !== null &&
      (ctx.self.emotion === 'attracted' || ctx.other.emotion === 'attracted') &&
      ctx.self.available &&
      ctx.other.available,
    restrictions: ['kiss', 'punch'],
    effects: ['mutual_love'],
  },

  kiss: {
    id: 'kiss',
    type: 'event',
    participants: 2,
    description: 'Beso entre ambos organismos.',
    triggers: 'Relación de enamoramiento mutuo activa.',
    duration: [2000, 4000],
    conditions: (ctx) => ctx.other !== null && ctx.relationship === 'mutual_love',
    restrictions: ['hug', 'punch', 'reject'],
    effects: ['mutual_love'],
  },

  punch: {
    id: 'punch',
    type: 'event',
    participants: 2,
    description: 'Puñetazo: golpe de un organismo al otro.',
    triggers: 'Relación de conflicto o rechazo previo.',
    duration: [800, 1500],
    conditions: (ctx) => ctx.other !== null && ctx.relationship === 'conflict',
    restrictions: ['hug', 'kiss', 'reject', 'approach'],
    effects: ['conflict'],
  },

  reject: {
    id: 'reject',
    type: 'event',
    participants: 2,
    description: 'Rechazo: un organismo rechaza al otro.',
    triggers: 'Uno atraído o enamorado y el otro tímido, neutral o nauseabundo.',
    duration: [1000, 2000],
    conditions: (ctx) =>
      ctx.other !== null &&
      (isAttracted(ctx.self) && isUnreceptive(ctx.other) ||
        isUnreceptive(ctx.self) && isAttracted(ctx.other)),
    restrictions: ['kiss', 'punch'],
    effects: ['conflict'],
  },

  euphoric_burst: {
    id: 'euphoric_burst',
    type: 'event',
    participants: 1,
    description: 'Explosión eufórica: estallido de euforia.',
    triggers: 'Emoción eufórica y organismo disponible.',
    duration: [2000, 4000],
    conditions: (ctx) => ctx.self.emotion === 'euphoric' && ctx.self.available,
    restrictions: [],
    effects: ['euphoric'],
  },

  faint: {
    id: 'faint',
    type: 'event',
    participants: 1,
    description: 'Desmayo: el organismo se desvanece temporalmente.',
    triggers: 'Emoción nauseabunda o sobrecarga emocional.',
    duration: [2000, 4000],
    conditions: (ctx) => ctx.self.emotion === 'nauseous',
    restrictions: [],
    effects: ['fainted'],
  },

  shake: {
    id: 'shake',
    type: 'event',
    participants: 1,
    description: 'Sacudida: sacudida de recuperación.',
    triggers: 'Fin del desmayo, euforia o reacción espontánea.',
    duration: [1000, 2000],
    conditions: (ctx) => ctx.self.emotion === 'fainted' || ctx.self.emotion === 'euphoric',
    restrictions: [],
    effects: ['neutral'],
    recoversFrom: ['fainted'],
  },

  limb_stretch: {
    id: 'limb_stretch',
    type: 'event',
    participants: 1,
    description: 'Estiramiento autónomo de una extremidad.',
    triggers: 'Organismo ocioso; disparo autónomo aleatorio.',
    duration: [1000, 2000],
    conditions: (ctx) => ctx.self.available && ctx.self.autonomousLimb === null,
    restrictions: [],
  },
});

const CATALOG = deepFreeze({ EMOTIONS, RELATIONSHIPS, EVENTS });

/**
 * Consulta de incompatibilidades para el futuro motor.
 *
 * Devuelve true si dos ids del mismo catálogo son mutuamente excluyentes
 * (alguno restringe al otro). Es simétrica: el orden de idA e idB no importa.
 * Funciona con EMOTIONS, RELATIONSHIPS y EVENTS (todos tienen `restrictions`).
 */
function areIncompatible(catalog, idA, idB) {
  const a = catalog[idA];
  const b = catalog[idB];
  if (!a || !b) return false;
  return a.restrictions.includes(idB) || b.restrictions.includes(idA);
}

// ---------------------------------------------------------------------------
// 2. OrganismState
// ---------------------------------------------------------------------------

/**
 * Estado mutable de un único organismo.
 *
 * Cada organismo tiene su propia emoción y puede funcionar en solitario. El
 * motor (etapa posterior) evalúa `conditions(ctx)` de los eventos para decidir
 * transiciones; OrganismState solo guarda y valida el estado.
 */
class OrganismState {
  constructor(id) {
    this.id = id;               // identificador único
    this.emotion = 'neutral';   // emoción actual (id de EMOTIONS)
    this.activeEvent = null;    // { eventId, partnerId, startedAt, duration }
    this.available = true;      // disponibilidad para iniciar otra acción
    this.autonomousLimb = null; // extremidad autónoma ('leftArm' | 'rightArm')
    this.cooldownUntil = 0;     // marca de tiempo (ms) sin eventos hasta aquí
    this.partnerId = null;      // organismo con el que interactúa
  }

  setEmotion(emotionId) {
    if (!EMOTIONS[emotionId]) throw new Error(`Emoción inexistente: ${emotionId}`);
    if (this.hasActiveEvent()) throw new Error('No se puede cambiar la emoción durante un evento activo');
    this.emotion = emotionId;
    return this;
  }

  startEvent(eventId, { partnerId = null, startedAt = 0, duration = 0, now = Date.now() } = {}) {
    if (!EVENTS[eventId]) throw new Error(`Evento inexistente: ${eventId}`);
    if (!this.canAct(now)) throw new Error(`No puede iniciar "${eventId}": ocupado o en cooldown`);
    const emotion = EMOTIONS[this.emotion];
    const event = EVENTS[eventId];
    if (emotion && emotion.blocksActions && !(event.recoversFrom || []).includes(this.emotion)) {
      throw new Error(`No puede iniciar "${eventId}": la emoción "${this.emotion}" bloquea las acciones`);
    }
    this.activeEvent = {
      eventId,
      partnerId: partnerId !== null ? partnerId : this.partnerId,
      startedAt: startedAt || now,
      duration: duration || EVENTS[eventId].duration[0],
    };
    if (partnerId !== null) this.partnerId = partnerId;
    this.available = false;
    return this;
  }

  endEvent() {
    this.activeEvent = null;
    this.available = true;
    return this;
  }

  hasActiveEvent() {
    return this.activeEvent !== null;
  }

  /** Progreso normalizado (0..1) del evento activo según el reloj dado. */
  eventProgress(now = Date.now()) {
    if (!this.activeEvent || !this.activeEvent.duration) return 0;
    const elapsed = now - this.activeEvent.startedAt;
    return Math.min(1, Math.max(0, elapsed / this.activeEvent.duration));
  }

  startCooldown(ms, now = Date.now()) {
    this.cooldownUntil = now + ms;
    return this;
  }

  cooldownRemaining(now = Date.now()) {
    return Math.max(0, this.cooldownUntil - now);
  }

  isCooldownActive(now = Date.now()) {
    return now < this.cooldownUntil;
  }

  /** Disponibilidad real: sin evento activo, marcado disponible y sin cooldown. */
  canAct(now = Date.now()) {
    return this.available && !this.hasActiveEvent() && !this.isCooldownActive(now);
  }
}

// ---------------------------------------------------------------------------
// 3. Emitter
// ---------------------------------------------------------------------------

/** Bus de eventos mínimo para emitir directivas sin acoplar los módulos. */
class Emitter {
  constructor() {
    this._listeners = new Map();
  }

  on(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
    return () => this._listeners.get(type).delete(handler);
  }

  emit(type, payload) {
    const listeners = this._listeners.get(type);
    if (!listeners) return;
    for (const handler of listeners) handler(payload);
  }
}

// ---------------------------------------------------------------------------
// 4. Reacciones (contenedor del sistema)
// ---------------------------------------------------------------------------

/**
 * Contenedor del sistema de comportamientos.
 *
 * Mantiene el mapa de organismos y las relaciones entre pares. Expone el bus
 * `events` para que bodies.js / enviroment.js se suscriban a las directivas.
 */
class Reacciones {
  constructor() {
    this.organisms = new Map();     // id -> OrganismState
    this.relationships = new Map(); // 'idA:idB' -> { state, since }
    this.events = new Emitter();    // bus para directivas ('directive')
  }

  registerOrganism({ id } = {}) {
    if (!id) throw new Error('registerOrganism requiere un id.');
    if (this.organisms.has(id)) return this.organisms.get(id);
    const state = new OrganismState(id);
    this.organisms.set(id, state);
    return state;
  }

  unregisterOrganism(id) {
    this.organisms.delete(id);
    for (const key of this.relationships.keys()) {
      const [a, b] = key.split(':');
      if (a === id || b === id) this.relationships.delete(key);
    }
    return this;
  }

  getOrganism(id) {
    return this.organisms.get(id) ?? null;
  }

  _pairKey(idA, idB) {
    return [idA, idB].sort().join(':');
  }

  setRelationship(idA, idB, relationshipId, now = Date.now()) {
    if (relationshipId === null) {
      this.relationships.delete(this._pairKey(idA, idB));
      return this;
    }
    if (idA === idB) throw new Error('Una relación necesita dos organismos distintos');
    if (!this.organisms.has(idA) || !this.organisms.has(idB)) {
      throw new Error('Ambos organismos deben estar registrados');
    }
    if (!RELATIONSHIPS[relationshipId]) throw new Error(`Relación inexistente: ${relationshipId}`);
    this.relationships.set(this._pairKey(idA, idB), { state: relationshipId, since: now });
    return this;
  }

  getRelationship(idA, idB) {
    return this.relationships.get(this._pairKey(idA, idB))?.state ?? null;
  }

  /**
   * Emite una directiva semántica que bodies.js traduce a representación
   * visual. Forma esperada:
   *   { organismId, behavior, phase, progress, params }
   */
  emitDirective(directive) {
    this.events.emit('directive', directive);
    return this;
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

const reacciones = {
  EMOTIONS,
  RELATIONSHIPS,
  EVENTS,
  CATALOG,
  areIncompatible,
  OrganismState,
  Emitter,
  Reacciones,
};

// UMD mínimo: navegador (window.reacciones) y Node (module.exports).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = reacciones;
}
if (typeof window !== 'undefined') {
  window.reacciones = reacciones;
}
