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
 *   5. Selección de comportamientos (B03): Weights, weightedPick,
 *      getEligibleEvents y BehaviorEngine.
 *
 * Extensión futura (sin rehacer este archivo): motor de comportamientos
 * (BehaviorEngine), transiciones espontáneas/reactivas y scheduling.
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
//   cooldown      number               pausa en ms tras finalizar el evento.
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
    cooldown: 2000,
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
    cooldown: 4000,
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
    cooldown: 3000,
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
    cooldown: 1500,
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
    cooldown: 2000,
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
    cooldown: 3000,
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
    cooldown: 3000,
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
    cooldown: 1500,
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
    cooldown: 1500,
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
    if (this.isBlockedByEmotion(eventId)) {
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

  /**
   * Indica si la emoción actual bloquea la ejecución de un evento concreto.
   * Solo ciertas emociones (p. ej. fainted) bloquean, y un evento que declara
   * `recoversFrom` esa emoción (p. ej. shake) sí puede ejecutarse.
   */
  isBlockedByEmotion(eventId) {
    const emotion = EMOTIONS[this.emotion];
    const event = EVENTS[eventId];
    if (!emotion || !event) return false;
    return emotion.blocksActions && !(event.recoversFrom || []).includes(this.emotion);
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

  /**
   * Avanza el estado: completa los eventos cuya duración venció, aplica sus
   * `effects` (emoción o relación) y arranca el cooldown correspondiente.
   */
  update(now = Date.now()) {
    for (const organism of this.organisms.values()) {
      if (!organism.hasActiveEvent()) continue;
      if (organism.eventProgress(now) < 1) continue;

      const { eventId, partnerId, duration } = organism.activeEvent;
      const event = EVENTS[eventId];
      organism.endEvent();

      if (event && event.effects && event.effects.length > 0) {
        this._applyEffects(organism, event.effects, now);
      }
      if (event && event.cooldown > 0) {
        organism.startCooldown(event.cooldown, now);
      }

      this.emitDirective({
        organismId: organism.id,
        behavior: eventId,
        phase: 'end',
        progress: 1,
        params: { partnerId, duration },
      });
    }
    return this;
  }

  /**
   * Aplica los efectos declarados por un evento finalizado. Cada efecto es un
   * id de emoción (cambia la emoción del organismo) o de relación (establece
   * la relación entre el organismo y su compañero).
   */
  _applyEffects(organism, effects, now) {
    for (const effectId of effects) {
      if (EMOTIONS[effectId]) {
        organism.setEmotion(effectId);
      } else if (RELATIONSHIPS[effectId]) {
        const partnerId = organism.partnerId;
        if (partnerId && this.organisms.has(partnerId)) {
          this.setRelationship(organism.id, partnerId, effectId, now);
        }
      } else {
        throw new Error(`Effect inexistente: ${effectId}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Selección de comportamientos (B03)
// ---------------------------------------------------------------------------

/**
 * Pesos relativos configurables para los eventos.
 *
 * Guarda un peso por id; los ids sin peso declarado usan 1 (uniforme). Los
 * pesos no necesitan sumar 1: se normalizan en el momento de la selección
 * (ver `weightedPick`). El peso 0 es válido y significa "nunca elegir".
 */
class Weights {
  constructor(initial = {}) {
    this._values = new Map();
    this.setAll(initial);
  }

  set(id, weight) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('El id de un peso debe ser un string no vacío');
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Peso inválido para "${id}": ${weight} (debe ser un número >= 0)`);
    }
    this._values.set(id, weight);
    return this;
  }

  setAll(weights) {
    for (const [id, weight] of Object.entries(weights)) this.set(id, weight);
    return this;
  }

  get(id) {
    return this._values.has(id) ? this._values.get(id) : 1;
  }

  delete(id) {
    this._values.delete(id);
    return this;
  }
}

/**
 * Selección aleatoria ponderada.
 *
 * candidates: array de elementos.
 * getWeight:  (item) => number, peso relativo (>= 0). El peso 0 excluye al
 *             candidato (nunca se elige).
 * random:     () => number en [0, 1). Inyectable para tests deterministas.
 *
 * Devuelve un elemento elegido según su peso, o null si no hay candidatos
 * con peso positivo. Lanza Error si algún peso es inválido (negativo o no
 * numérico).
 */
function weightedPick(candidates, getWeight, random = Math.random) {
  const entries = [];
  let total = 0;

  for (const candidate of candidates) {
    const weight = getWeight(candidate);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Peso inválido para el candidato "${String(candidate)}": ${weight}`);
    }
    if (weight > 0) {
      entries.push({ candidate, weight });
      total += weight;
    }
  }

  if (entries.length === 0) return null;

  const roll = random() * total;
  let cumulative = 0;
  for (const { candidate, weight } of entries) {
    cumulative += weight;
    if (roll < cumulative) return candidate;
  }
  return entries[entries.length - 1].candidate;
}

/**
 * Devuelve los ids de los eventos elegibles para un organismo en este momento.
 *
 * ctx: { self, other, relationship } — mismo contrato que `conditions(ctx)`.
 *   self: OrganismState del organismo que se evalúa.
 *   other: OrganismState del compañero, o null si no hay.
 *   relationship: id de relación entre self y other, o null.
 * now: marca de tiempo para evaluar disponibilidad y cooldowns.
 *
 * Un evento es elegible si:
 *   - self puede actuar (disponible, sin evento activo, sin cooldown);
 *   - la emoción de self no bloquea ese evento (p. ej. fainted);
 *   - si es de a dos: existe un compañero capaz de actuar y no bloqueado;
 *   - no es incompatible con el evento activo del compañero;
 *   - conditions(ctx) es true.
 *
 * Devuelve un array de ids (strings), posiblemente vacío.
 */
function getEligibleEvents(ctx, now = Date.now()) {
  const { self, other = null, relationship = null } = ctx;
  if (!self.canAct(now)) return [];

  const evalCtx = { self, other, relationship };
  const eligible = [];

  for (const event of Object.values(EVENTS)) {
    if (self.isBlockedByEmotion(event.id)) continue;

    if (event.participants === 2) {
      if (!other || !other.canAct(now) || other.isBlockedByEmotion(event.id)) continue;
      if (other.activeEvent && areIncompatible(EVENTS, event.id, other.activeEvent.eventId)) continue;
    }

    if (!event.conditions(evalCtx)) continue;

    eligible.push(event.id);
  }

  return eligible;
}

/**
 * Motor de comportamientos: decide qué evento arranca y cuándo, integrando
 * pesos, elegibilidad y avance temporal. Es independiente de la representación
 * visual: solo emite directivas semánticas.
 *
 * Composición sobre una instancia de Reacciones:
 *   const engine = new BehaviorEngine(reacciones, { weights, random, minGap });
 *
 * - `weights`: pesos relativos por evento (objeto o instancia de Weights).
 * - `random`:   inyectable para tests deterministas (default Math.random).
 * - `minGap`:   ms mínimos entre decisiones de selección (default 1000).
 */
class BehaviorEngine {
  constructor(system, { weights = {}, random = Math.random, minGap = 1000 } = {}) {
    if (!system || typeof system.update !== 'function') {
      throw new Error('BehaviorEngine requiere una instancia de Reacciones');
    }
    this.system = system;
    this.weights = weights instanceof Weights ? weights : new Weights(weights);
    this.random = random;
    this.minGap = minGap;
    this._nextDecisionAt = 0;
  }

  /**
   * Avanza el estado y, si pasó el intervalo mínimo entre decisiones, intenta
   * iniciar un evento elegible (seleccionado al azar según los pesos).
   */
  update(now = Date.now()) {
    this.system.update(now);

    if (now < this._nextDecisionAt) return this;
    this._nextDecisionAt = now + this.minGap;

    const candidates = this._buildCandidates(now);
    if (candidates.length === 0) return this;

    const chosen = weightedPick(candidates, (c) => this.weights.get(c.eventId), this.random);
    if (!chosen) return this;

    this._startCandidate(chosen, now);
    return this;
  }

  /** Compañero actual de un organismo (el modelo contempla hasta dos). */
  _findPartner(self) {
    for (const other of this.system.organisms.values()) {
      if (other.id !== self.id) return other;
    }
    return null;
  }

  /**
   * Construye los candidatos elegibles: eventos individuales por organismo y
   * eventos de a dos evaluados una sola vez por par (las condiciones de a dos
   * son simétricas).
   */
  _buildCandidates(now) {
    const organisms = [...this.system.organisms.values()];
    const candidates = [];

    for (const self of organisms) {
      const singles = getEligibleEvents({ self, other: null, relationship: null }, now);
      for (const eventId of singles) {
        candidates.push({ eventId, actors: [self] });
      }
    }

    if (organisms.length >= 2) {
      const [a, b] = organisms;
      const relationship = this.system.getRelationship(a.id, b.id);
      const pairs = getEligibleEvents({ self: a, other: b, relationship }, now);
      for (const eventId of pairs) {
        if (EVENTS[eventId].participants === 2) {
          candidates.push({ eventId, actors: [a, b] });
        }
      }
    }

    return candidates;
  }

  /** Inicia el evento elegido y emite una directiva 'start' por organismo. */
  _startCandidate(candidate, now) {
    const event = EVENTS[candidate.eventId];
    const actors = candidate.actors;

    if (actors.length === 2) {
      actors[0].startEvent(event.id, { partnerId: actors[1].id, now });
      actors[1].startEvent(event.id, { partnerId: actors[0].id, now });
    } else {
      actors[0].startEvent(event.id, { now });
    }

    for (const actor of actors) {
      const partnerId = actors.length === 2
        ? actors.find((other) => other.id !== actor.id).id
        : null;
      this.system.emitDirective({
        organismId: actor.id,
        behavior: event.id,
        phase: 'start',
        progress: 0,
        params: { partnerId, duration: actor.activeEvent.duration },
      });
    }
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
  Weights,
  weightedPick,
  getEligibleEvents,
  BehaviorEngine,
};

// UMD mínimo: navegador (window.reacciones) y Node (module.exports).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = reacciones;
}
if (typeof window !== 'undefined') {
  window.reacciones = reacciones;
}
