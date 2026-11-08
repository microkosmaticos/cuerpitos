'use strict';

/**
 * reaccions.test.js — Pruebas automatizadas del módulo de comportamientos.
 *
 * Usa el runner nativo de Node (`node:test`), sin dependencias externas y sin
 * webcam ni organismos visuales. Se ejecuta con:
 *
 *   node --test
 *
 * o, para correr solo este archivo:
 *
 *   node --test reaccions.test.js
 *
 * Los organismos son solo identificadores (strings); no dependen de bodies.js.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('./reaccions.js');

// ---------------------------------------------------------------------------
// B01 — Catálogo de emociones
// ---------------------------------------------------------------------------

describe('B01 — Catálogo de emociones (EMOTIONS)', () => {
  it('contiene las 7 emociones individuales esperadas', () => {
    const ids = ['neutral', 'shy', 'attracted', 'lovestruck', 'euphoric', 'nauseous', 'fainted'];
    assert.deepEqual(Object.keys(EMOTIONS).sort(), [...ids].sort());
  });

  it('cada emoción declara los campos obligatorios y participantes = 1', () => {
    for (const [key, entry] of Object.entries(EMOTIONS)) {
      assert.equal(entry.id, key, 'el id debe coincidir con su clave en el catálogo');
      assert.ok(typeof entry.id === 'string' && entry.id.length > 0, 'el id debe ser un string no vacío');
      assert.equal(entry.type, 'emotion', `${entry.id} debe ser tipo "emotion"`);
      assert.equal(entry.participants, 1, `${entry.id} requiere 1 organismo`);
      assert.equal(typeof entry.description, 'string', `${entry.id} sin descripción`);
      assert.equal(typeof entry.triggers, 'string', `${entry.id} sin triggers`);
      assert.ok(Array.isArray(entry.restrictions), `${entry.id} sin restrictions`);
    }
  });

  it('las restricciones referencian solo emociones existentes', () => {
    const ids = new Set(Object.keys(EMOTIONS));
    for (const entry of Object.values(EMOTIONS)) {
      for (const restricted of entry.restrictions) {
        assert.ok(ids.has(restricted), `${entry.id} restringe una emoción inexistente: ${restricted}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// B01 — Catálogo de relaciones
// ---------------------------------------------------------------------------

describe('B01 — Catálogo de relaciones (RELATIONSHIPS)', () => {
  it('contiene los 2 estados de relación esperados', () => {
    assert.deepEqual(Object.keys(RELATIONSHIPS).sort(), ['conflict', 'mutual_love']);
  });

  it('cada relación requiere 2 organismos y es mutuamente excluyente', () => {
    assert.equal(RELATIONSHIPS.mutual_love.participants, 2);
    assert.equal(RELATIONSHIPS.conflict.participants, 2);
    assert.deepEqual(RELATIONSHIPS.mutual_love.restrictions, ['conflict']);
    assert.deepEqual(RELATIONSHIPS.conflict.restrictions, ['mutual_love']);
  });
});

// ---------------------------------------------------------------------------
// B01 — Catálogo de eventos
// ---------------------------------------------------------------------------

describe('B01 — Catálogo de eventos (EVENTS)', () => {
  it('contiene los 9 eventos esperados', () => {
    const ids = ['approach', 'hug', 'kiss', 'punch', 'reject', 'euphoric_burst', 'faint', 'shake', 'limb_stretch'];
    assert.deepEqual(Object.keys(EVENTS).sort(), [...ids].sort());
  });

  it('cada evento declara duración [min,max] y una precondición ejecutable', () => {
    for (const entry of Object.values(EVENTS)) {
      assert.ok(Array.isArray(entry.duration), `${entry.id} sin duration`);
      assert.equal(entry.duration.length, 2, `${entry.id} duration debe ser [min, max]`);
      assert.ok(entry.duration[0] <= entry.duration[1], `${entry.id} duration inválida (min > max)`);
      assert.equal(typeof entry.conditions, 'function', `${entry.id} sin conditions(ctx)`);
      assert.equal(typeof entry.description, 'string', `${entry.id} sin descripción`);
      assert.ok(Array.isArray(entry.restrictions), `${entry.id} sin restrictions`);
    }
  });

  it('participants es 1 o 2 para todos los eventos', () => {
    for (const entry of Object.values(EVENTS)) {
      assert.ok(
        entry.participants === 1 || entry.participants === 2,
        `${entry.id} tiene participants inválido: ${entry.participants}`,
      );
    }
  });

  it('las restricciones referencian solo eventos existentes', () => {
    const ids = new Set(Object.keys(EVENTS));
    for (const entry of Object.values(EVENTS)) {
      for (const restricted of entry.restrictions) {
        assert.ok(ids.has(restricted), `${entry.id} restringe un evento inexistente: ${restricted}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// B01 — Agrupación en CATALOG
// ---------------------------------------------------------------------------

describe('B01 — Agrupación CATALOG', () => {
  it('agrupa los tres catálogos bajo una misma referencia', () => {
    assert.equal(CATALOG.EMOTIONS, EMOTIONS);
    assert.equal(CATALOG.RELATIONSHIPS, RELATIONSHIPS);
    assert.equal(CATALOG.EVENTS, EVENTS);
  });
});

// ---------------------------------------------------------------------------
// B02 — OrganismState
// ---------------------------------------------------------------------------

describe('B02 — OrganismState (estado por organismo)', () => {
  it('crea un organismo neutral, disponible y con id propio', () => {
    const org = new OrganismState('org-1');
    assert.equal(org.id, 'org-1');
    assert.equal(org.emotion, 'neutral');
    assert.equal(org.available, true);
    assert.equal(org.activeEvent, null);
    assert.equal(org.autonomousLimb, null);
    assert.equal(org.cooldownUntil, 0);
    assert.equal(org.partnerId, null);
  });

  it('cambia de emoción con setEmotion', () => {
    const org = new OrganismState('org-1');
    org.setEmotion('attracted');
    assert.equal(org.emotion, 'attracted');
    org.setEmotion('euphoric');
    assert.equal(org.emotion, 'euphoric');
  });

  it('inicia un evento: queda ocupado y registra al compañero', () => {
    const org = new OrganismState('org-1');
    org.startEvent('hug', { partnerId: 'org-2', duration: 3500, now: 1000 });
    assert.equal(org.available, false);
    assert.equal(org.hasActiveEvent(), true);
    assert.equal(org.activeEvent.eventId, 'hug');
    assert.equal(org.activeEvent.partnerId, 'org-2');
    assert.equal(org.partnerId, 'org-2');
  });

  it('finaliza un evento y recupera la disponibilidad', () => {
    const org = new OrganismState('org-1');
    org.startEvent('hug', { duration: 3500 });
    assert.equal(org.available, false);
    org.endEvent();
    assert.equal(org.available, true);
    assert.equal(org.activeEvent, null);
  });

  it('calcula el progreso normalizado del evento (0..1)', () => {
    const org = new OrganismState('org-1');
    org.startEvent('faint', { duration: 1000, now: 0 });
    assert.equal(org.eventProgress(0), 0);
    assert.equal(org.eventProgress(500), 0.5);
    assert.equal(org.eventProgress(1000), 1);
    assert.equal(org.eventProgress(2000), 1, 'el progreso satura en 1');
  });

  it('controla la disponibilidad con el cooldown', () => {
    const org = new OrganismState('org-1');
    assert.equal(org.canAct(0), true);
    org.startCooldown(1000, 0);
    assert.equal(org.isCooldownActive(500), true);
    assert.equal(org.cooldownRemaining(500), 500);
    assert.equal(org.canAct(500), false);
    assert.equal(org.canAct(1000), true);
  });
});

// ---------------------------------------------------------------------------
// B02 — Reacciones (organismos y relaciones)
// ---------------------------------------------------------------------------

describe('B02 — Reacciones (contenedor del sistema)', () => {
  it('crea organismos con identificadores diferentes', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    assert.notEqual(a, b);
    assert.equal(a.id, 'org-A');
    assert.equal(b.id, 'org-B');
    assert.equal(system.getOrganism('org-A'), a);
    assert.equal(system.getOrganism('org-B'), b);
  });

  it('rechaza registrar un organismo sin id', () => {
    const system = new Reacciones();
    assert.throws(() => system.registerOrganism({}), /id/);
    assert.throws(() => system.registerOrganism(), /id/);
  });

  it('reutiliza el mismo estado si el id ya existe', () => {
    const system = new Reacciones();
    const first = system.registerOrganism({ id: 'org-A' });
    const again = system.registerOrganism({ id: 'org-A' });
    assert.equal(first, again);
  });

  it('mantiene emociones independientes entre organismos', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    a.setEmotion('lovestruck');
    b.setEmotion('shy');
    assert.equal(a.emotion, 'lovestruck');
    assert.equal(b.emotion, 'shy');
  });

  it('registra y lee relaciones de forma simétrica', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    system.registerOrganism({ id: 'org-B' });
    system.setRelationship('org-A', 'org-B', 'mutual_love');
    assert.equal(system.getRelationship('org-A', 'org-B'), 'mutual_love');
    assert.equal(system.getRelationship('org-B', 'org-A'), 'mutual_love');
    assert.equal(system.getRelationship('org-A', 'org-C'), null);
  });

  it('elimina una relación pasando null', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    system.registerOrganism({ id: 'org-B' });
    system.setRelationship('org-A', 'org-B', 'mutual_love');
    system.setRelationship('org-A', 'org-B', null);
    assert.equal(system.getRelationship('org-A', 'org-B'), null);
  });

  it('limpia las relaciones al eliminar un organismo', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    system.registerOrganism({ id: 'org-B' });
    system.registerOrganism({ id: 'org-C' });
    system.setRelationship('org-A', 'org-B', 'mutual_love');
    system.setRelationship('org-A', 'org-C', 'conflict');
    system.unregisterOrganism('org-A');

    assert.equal(system.getOrganism('org-A'), null);
    assert.equal(system.getRelationship('org-A', 'org-B'), null);
    assert.equal(system.getRelationship('org-A', 'org-C'), null);

    // los demás organismos y sus datos no se ven afectados
    assert.equal(system.getOrganism('org-B').id, 'org-B');
    assert.equal(system.getOrganism('org-C').id, 'org-C');
  });
});

// ---------------------------------------------------------------------------
// Precondiciones de eventos (conditions)
// ---------------------------------------------------------------------------

describe('Precondiciones de eventos (conditions)', () => {
  it('los eventos de a dos se deshabilitan sin compañero presente', () => {
    const system = new Reacciones();
    const solo = system.registerOrganism({ id: 'org-1' });
    const soloCtx = { self: solo, other: null, relationship: null };
    assert.equal(EVENTS.approach.conditions(soloCtx), false);
    assert.equal(EVENTS.hug.conditions(soloCtx), false);
    assert.equal(EVENTS.reject.conditions(soloCtx), false);
    assert.equal(EVENTS.kiss.conditions({ self: solo, other: null, relationship: 'mutual_love' }), false);
    assert.equal(EVENTS.punch.conditions({ self: solo, other: null, relationship: 'conflict' }), false);
  });

  it('un evento compartido se habilita con dos organismos compatibles', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    const ctx = { self: a, other: b, relationship: null };

    assert.equal(EVENTS.hug.conditions(ctx), true, 'abrazo: al menos uno atraído');
    assert.equal(EVENTS.reject.conditions(ctx), true, 'rechazo: atraído vs tímido');
  });

  it('un organismo ocupado no habilita un evento compartido', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    a.setEmotion('attracted');
    b.setEmotion('neutral');
    const ctx = { self: a, other: b, relationship: null };

    assert.equal(EVENTS.hug.conditions(ctx), true);
    a.startEvent('hug', { partnerId: 'org-B', duration: 1000 });
    assert.equal(EVENTS.hug.conditions(ctx), false, 'el organismo A quedó ocupado');
  });

  it('el beso exige enamoramiento mutuo; el puñetazo exige conflicto', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });

    assert.equal(EVENTS.kiss.conditions({ self: a, other: b, relationship: 'mutual_love' }), true);
    assert.equal(EVENTS.kiss.conditions({ self: a, other: b, relationship: 'conflict' }), false);

    assert.equal(EVENTS.punch.conditions({ self: a, other: b, relationship: 'conflict' }), true);
    assert.equal(EVENTS.punch.conditions({ self: a, other: b, relationship: 'mutual_love' }), false);
  });
});

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

describe('Emitter (bus de eventos)', () => {
  it('notifica a los suscriptores y permite desuscribirse', () => {
    const emitter = new Emitter();
    const received = [];
    const off = emitter.on('directive', (payload) => received.push(payload));

    emitter.emit('directive', { behavior: 'faint' });
    assert.equal(received.length, 1);
    assert.equal(received[0].behavior, 'faint');

    off();
    emitter.emit('directive', { behavior: 'shake' });
    assert.equal(received.length, 1, 'tras desuscribirse no debe recibir más');
  });

  it('soporta varios suscriptores del mismo tipo', () => {
    const emitter = new Emitter();
    let count = 0;
    emitter.on('directive', () => { count += 1; });
    emitter.on('directive', () => { count += 1; });
    emitter.emit('directive', {});
    assert.equal(count, 2);
  });

  it('no falla al emitir sin suscriptores', () => {
    const emitter = new Emitter();
    assert.doesNotThrow(() => emitter.emit('directive', { behavior: 'hug' }));
  });
});

// ---------------------------------------------------------------------------
// Reacciones — emisión de directivas
// ---------------------------------------------------------------------------

describe('Reacciones — emisión de directivas', () => {
  it('emitDirective publica en el bus events', () => {
    const system = new Reacciones();
    const received = [];
    system.events.on('directive', (d) => received.push(d));

    system.emitDirective({ organismId: 'org-A', behavior: 'faint', phase: 'start', progress: 0 });

    assert.equal(received.length, 1);
    assert.equal(received[0].organismId, 'org-A');
    assert.equal(received[0].behavior, 'faint');
    assert.equal(received[0].phase, 'start');
  });
});

// ---------------------------------------------------------------------------
// Integridad estructural del catálogo
// ---------------------------------------------------------------------------

describe('Integridad estructural del catálogo', () => {
  it('el id de cada entrada coincide con su clave', () => {
    for (const catalog of [EMOTIONS, RELATIONSHIPS, EVENTS]) {
      for (const [key, entry] of Object.entries(catalog)) {
        assert.equal(entry.id, key, `el id de ${key} no coincide con su clave`);
        assert.ok(typeof entry.id === 'string' && entry.id.length > 0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Simetría de restrictions
// ---------------------------------------------------------------------------

describe('Simetría de restrictions', () => {
  it('toda restricción es recíproca en los tres catálogos', () => {
    for (const catalog of [EMOTIONS, RELATIONSHIPS, EVENTS]) {
      for (const [id, entry] of Object.entries(catalog)) {
        for (const other of entry.restrictions) {
          assert.ok(
            catalog[other].restrictions.includes(id),
            `restricción asimétrica: ${id} restringe a ${other}, pero no al revés`,
          );
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Helper areIncompatible
// ---------------------------------------------------------------------------

describe('areIncompatible (consulta de incompatibilidades)', () => {
  it('es simétrico entre eventos incompatibles', () => {
    assert.equal(areIncompatible(EVENTS, 'hug', 'kiss'), true);
    assert.equal(areIncompatible(EVENTS, 'kiss', 'hug'), true);
    assert.equal(areIncompatible(EVENTS, 'punch', 'approach'), true);
    assert.equal(areIncompatible(EVENTS, 'approach', 'punch'), true);
  });

  it('no marca como incompatibles las secuencias válidas', () => {
    assert.equal(areIncompatible(EVENTS, 'approach', 'hug'), false);
    assert.equal(areIncompatible(EVENTS, 'approach', 'kiss'), false);
    assert.equal(areIncompatible(EVENTS, 'hug', 'approach'), false);
  });

  it('funciona con emociones y relaciones', () => {
    assert.equal(areIncompatible(EMOTIONS, 'shy', 'euphoric'), true);
    assert.equal(areIncompatible(EMOTIONS, 'fainted', 'euphoric'), true);
    assert.equal(areIncompatible(RELATIONSHIPS, 'mutual_love', 'conflict'), true);
  });

  it('devuelve false para ids inexistentes o sin restricción', () => {
    assert.equal(areIncompatible(EVENTS, 'hug', 'nope'), false);
    assert.equal(areIncompatible(EMOTIONS, 'shy', 'neutral'), false);
    assert.equal(areIncompatible(EVENTS, 'shake', 'limb_stretch'), false);
  });
});

// ---------------------------------------------------------------------------
// Validaciones (throw en datos inválidos)
// ---------------------------------------------------------------------------

describe('Validaciones (throw en datos inválidos)', () => {
  it('setEmotion rechaza emociones inexistentes', () => {
    const org = new OrganismState('org-1');
    assert.throws(() => org.setEmotion('nope'), /inexistente/);
  });

  it('setEmotion no permite cambiar la emoción durante un evento', () => {
    const org = new OrganismState('org-1');
    org.startEvent('faint', { duration: 1000 });
    assert.throws(() => org.setEmotion('euphoric'), /evento activo/);
  });

  it('startEvent rechaza eventos inexistentes', () => {
    const org = new OrganismState('org-1');
    assert.throws(() => org.startEvent('nope'), /inexistente/);
  });

  it('startEvent rechaza iniciar un evento estando ocupado', () => {
    const org = new OrganismState('org-1');
    org.startEvent('faint', { duration: 1000 });
    assert.throws(() => org.startEvent('shake'), /ocupado/);
  });

  it('startEvent rechaza iniciar un evento durante el cooldown', () => {
    const org = new OrganismState('org-1');
    org.startCooldown(1000, 0);
    assert.throws(() => org.startEvent('shake', { now: 500 }), /cooldown/);
  });

  it('setRelationship rechaza el mismo organismo', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    assert.throws(() => system.setRelationship('org-A', 'org-A', 'mutual_love'), /distintos/);
  });

  it('setRelationship rechaza organismos no registrados', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    assert.throws(() => system.setRelationship('org-A', 'org-B', 'mutual_love'), /registrados/);
  });

  it('setRelationship rechaza relaciones inexistentes', () => {
    const system = new Reacciones();
    system.registerOrganism({ id: 'org-A' });
    system.registerOrganism({ id: 'org-B' });
    assert.throws(() => system.setRelationship('org-A', 'org-B', 'nope'), /inexistente/);
  });
});

// ---------------------------------------------------------------------------
// Inmutabilidad de los catálogos
// ---------------------------------------------------------------------------

describe('Inmutabilidad de los catálogos', () => {
  it('los catálogos y sus entradas están congelados', () => {
    for (const catalog of [EMOTIONS, RELATIONSHIPS, EVENTS, CATALOG]) {
      assert.equal(Object.isFrozen(catalog), true);
    }
    for (const catalog of [EMOTIONS, RELATIONSHIPS, EVENTS]) {
      for (const entry of Object.values(catalog)) {
        assert.equal(Object.isFrozen(entry), true, `entrada ${entry.id} no congelada`);
        assert.equal(Object.isFrozen(entry.restrictions), true, `restrictions de ${entry.id} no congelado`);
        if (entry.duration) assert.equal(Object.isFrozen(entry.duration), true);
      }
    }
  });

  it('mutar una entrada lanza TypeError (modo estricto)', () => {
    assert.throws(() => { EMOTIONS.neutral.description = 'roto'; }, TypeError);
    assert.throws(() => { EVENTS.hug.duration[0] = -1; }, TypeError);
    assert.throws(() => { EVENTS.hug.restrictions.push('faint'); }, TypeError);
  });
});

// ---------------------------------------------------------------------------
// Disponibilidad y cooldown tras finalizar un evento
// ---------------------------------------------------------------------------

describe('Disponibilidad y cooldown tras finalizar un evento', () => {
  it('finalizar un evento no permite actuar si el cooldown sigue activo', () => {
    const org = new OrganismState('org-1');
    org.startEvent('hug', { duration: 1000, now: 0 });
    org.startCooldown(500, 0);
    org.endEvent();
    assert.equal(org.available, true, 'quedó marcado como disponible');
    assert.equal(org.canAct(0), false, 'el cooldown sigue bloqueando');
    assert.equal(org.canAct(500), true, 'tras expirar el cooldown ya puede actuar');
  });
});

// ---------------------------------------------------------------------------
// Duraciones y casos límite
// ---------------------------------------------------------------------------

describe('Duraciones y casos límite', () => {
  it('toda duración es [min,max] con min >= 0 y min <= max', () => {
    for (const entry of Object.values(EVENTS)) {
      const [min, max] = entry.duration;
      assert.ok(Number.isFinite(min) && Number.isFinite(max), `${entry.id} duración no numérica`);
      assert.ok(min >= 0, `${entry.id} duración mínima negativa`);
      assert.ok(max >= min, `${entry.id} duración inválida (min > max)`);
    }
  });

  it('eventProgress no da NaN con duración cero', () => {
    const org = new OrganismState('org-1');
    org.activeEvent = { eventId: 'hug', partnerId: null, startedAt: 0, duration: 0 };
    assert.equal(org.eventProgress(100), 0);
  });

  it('eventProgress clampa el progreso entre 0 y 1', () => {
    const org = new OrganismState('org-1');
    org.startEvent('hug', { duration: 1000, now: 0 });
    assert.equal(org.eventProgress(-500), 0, 'tiempo negativo se clampa a 0');
    assert.equal(org.eventProgress(1500), 1, 'tiempo excedido se clampa a 1');
  });

  it('startEvent usa la duración mínima del catálogo si no se indica', () => {
    const org = new OrganismState('org-1');
    org.startEvent('hug', { now: 0 });
    assert.equal(org.activeEvent.duration, EVENTS.hug.duration[0]);
  });
});

// ---------------------------------------------------------------------------
// Precondiciones de eventos individuales
// ---------------------------------------------------------------------------

describe('Precondiciones de eventos individuales', () => {
  it('faint exige emoción nauseabunda', () => {
    const org = new OrganismState('org-1');
    assert.equal(EVENTS.faint.conditions({ self: org }), false);
    org.setEmotion('nauseous');
    assert.equal(EVENTS.faint.conditions({ self: org }), true);
  });

  it('euphoric_burst exige euforia y disponibilidad', () => {
    const org = new OrganismState('org-1');
    assert.equal(EVENTS.euphoric_burst.conditions({ self: org }), false);
    org.setEmotion('euphoric');
    assert.equal(EVENTS.euphoric_burst.conditions({ self: org }), true);
    org.startEvent('euphoric_burst', { duration: 1000 });
    assert.equal(EVENTS.euphoric_burst.conditions({ self: org }), false);
  });

  it('shake exige estar desmayado o eufórico', () => {
    const org = new OrganismState('org-1');
    assert.equal(EVENTS.shake.conditions({ self: org }), false);
    org.setEmotion('fainted');
    assert.equal(EVENTS.shake.conditions({ self: org }), true);
    org.setEmotion('euphoric');
    assert.equal(EVENTS.shake.conditions({ self: org }), true);
  });

  it('limb_stretch exige disponibilidad y extremidad libre', () => {
    const org = new OrganismState('org-1');
    assert.equal(EVENTS.limb_stretch.conditions({ self: org }), true);
    org.autonomousLimb = 'leftArm';
    assert.equal(EVENTS.limb_stretch.conditions({ self: org }), false);
  });

  it('approach se bloquea si alguno está desmayado (emoción)', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    b.setEmotion('fainted');
    assert.equal(EVENTS.approach.conditions({ self: a, other: b, relationship: null }), false);
  });

  it('reject es bidireccional', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    assert.equal(EVENTS.reject.conditions({ self: a, other: b, relationship: null }), true);
    assert.equal(EVENTS.reject.conditions({ self: b, other: a, relationship: null }), true);
    a.setEmotion('neutral');
    b.setEmotion('neutral');
    assert.equal(EVENTS.reject.conditions({ self: a, other: b, relationship: null }), false);
  });

  it('un organismo ocupado (desmayándose) no puede ser abrazado', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'org-A' });
    const b = system.registerOrganism({ id: 'org-B' });
    a.setEmotion('attracted');
    b.startEvent('faint', { duration: 1000 }); // b queda ocupado
    assert.equal(EVENTS.hug.conditions({ self: a, other: b, relationship: null }), false);
  });
});

// ---------------------------------------------------------------------------
// Estado desmayado bloquea acciones (B02.1)
// ---------------------------------------------------------------------------

describe('Estado desmayado bloquea acciones', () => {
  it('un organismo con emoción fainted no puede iniciar otros eventos', () => {
    const org = new OrganismState('org-1');
    org.setEmotion('fainted');
    assert.throws(() => org.startEvent('hug', { partnerId: 'org-2' }), /bloquea/);
    assert.throws(() => org.startEvent('approach', { partnerId: 'org-2' }), /bloquea/);
    assert.throws(() => org.startEvent('faint'), /bloquea/);
  });

  it('shake es la recuperación y sí puede iniciarse estando desmayado', () => {
    const org = new OrganismState('org-1');
    org.setEmotion('fainted');
    assert.doesNotThrow(() => org.startEvent('shake', { duration: 1000 }));
    assert.equal(org.hasActiveEvent(), true);
    assert.equal(org.activeEvent.eventId, 'shake');
  });

  it('una emoción no bloqueante (nauseous) permite iniciar eventos', () => {
    const org = new OrganismState('org-1');
    org.setEmotion('nauseous');
    assert.doesNotThrow(() => org.startEvent('faint', { duration: 1000 }));
  });
});

// ---------------------------------------------------------------------------
// B03.1 — Weights (pesos configurables)
// ---------------------------------------------------------------------------

describe('B03.1 — Weights (pesos configurables)', () => {
  it('usa peso uniforme 1 por defecto', () => {
    const weights = new Weights();
    assert.equal(weights.get('cualquier-id'), 1);
  });

  it('set/get guarda y devuelve el peso', () => {
    const weights = new Weights();
    weights.set('hug', 2);
    assert.equal(weights.get('hug'), 2);
  });

  it('acepta peso 0 como válido (significa "nunca elegir")', () => {
    const weights = new Weights();
    assert.doesNotThrow(() => weights.set('faint', 0));
    assert.equal(weights.get('faint'), 0);
  });

  it('setAll carga varios pesos de una vez', () => {
    const weights = new Weights({ hug: 2, kiss: 3 });
    assert.equal(weights.get('hug'), 2);
    assert.equal(weights.get('kiss'), 3);
    assert.equal(weights.get('punch'), 1, 'sin declarar usa el default');
  });

  it('rechaza pesos inválidos (negativos, NaN, infinito)', () => {
    const weights = new Weights();
    assert.throws(() => weights.set('hug', -1), /Peso inv/);
    assert.throws(() => weights.set('hug', NaN), /Peso inv/);
    assert.throws(() => weights.set('hug', Infinity), /Peso inv/);
  });

  it('rechaza ids inválidos (vacío o no string)', () => {
    const weights = new Weights();
    assert.throws(() => weights.set('', 1), /id/);
    assert.throws(() => weights.set(123, 1), /id/);
  });

  it('delete vuelve al peso por defecto', () => {
    const weights = new Weights();
    weights.set('hug', 2);
    weights.delete('hug');
    assert.equal(weights.get('hug'), 1);
  });
});

// ---------------------------------------------------------------------------
// B03.1 — weightedPick (selección ponderada)
// ---------------------------------------------------------------------------

describe('B03.1 — weightedPick (selección ponderada)', () => {
  it('devuelve null con lista vacía', () => {
    assert.equal(weightedPick([], () => 1), null);
  });

  it('devuelve null si todos los pesos son 0', () => {
    assert.equal(weightedPick(['a', 'b'], () => 0), null);
  });

  it('respeta los pesos relativos (random determinista)', () => {
    const getWeight = (id) => ({ a: 1, b: 2, c: 3 }[id]);
    const candidates = ['a', 'b', 'c'];
    // total = 6 → roll = random() * 6
    assert.equal(weightedPick(candidates, getWeight, () => 0), 'a');
    assert.equal(weightedPick(candidates, getWeight, () => 0.2), 'b');
    assert.equal(weightedPick(candidates, getWeight, () => 0.5), 'c');
    assert.equal(weightedPick(candidates, getWeight, () => 0.99), 'c');
  });

  it('nunca elige un candidato con peso 0', () => {
    const getWeight = (id) => (id === 'zero' ? 0 : 1);
    const candidates = ['zero', 'one', 'two'];
    for (let i = 0; i < 20; i++) {
      const picked = weightedPick(candidates, getWeight, () => i / 20);
      assert.notEqual(picked, 'zero');
    }
  });

  it('lanza error con pesos inválidos (negativos o no numéricos)', () => {
    assert.throws(() => weightedPick(['a'], () => -1), /Peso inv/);
    assert.throws(() => weightedPick(['a'], () => NaN), /Peso inv/);
    assert.throws(() => weightedPick(['a'], () => Infinity), /Peso inv/);
  });
});

// ---------------------------------------------------------------------------
// B03.2 — getEligibleEvents (eventos elegibles)
// ---------------------------------------------------------------------------

describe('B03.2 — getEligibleEvents (eventos elegibles)', () => {
  it('devuelve eventos individuales elegibles para un organismo neutral y ocioso', () => {
    const org = new OrganismState('org-1');
    const eligible = getEligibleEvents({ self: org, other: null, relationship: null }, 0);
    assert.ok(eligible.includes('limb_stretch'), 'limb_stretch: disponible y extremidad libre');
    assert.ok(!eligible.includes('faint'), 'faint requiere nauseous');
    assert.ok(!eligible.includes('shake'), 'shake requiere fainted/euphoric');
    assert.ok(!eligible.includes('euphoric_burst'), 'euphoric_burst requiere euphoric');
    assert.ok(!eligible.includes('hug'), 'hug requiere compañero');
    assert.ok(!eligible.includes('kiss'), 'kiss requiere compañero');
  });

  it('un organismo ocupado no tiene eventos elegibles', () => {
    const org = new OrganismState('org-1');
    org.startEvent('faint', { duration: 1000 });
    const eligible = getEligibleEvents({ self: org, other: null, relationship: null }, 0);
    assert.deepEqual(eligible, []);
  });

  it('un organismo en cooldown no tiene eventos elegibles', () => {
    const org = new OrganismState('org-1');
    org.startCooldown(1000, 0);
    const eligible = getEligibleEvents({ self: org, other: null, relationship: null }, 500);
    assert.deepEqual(eligible, []);
  });

  it('un organismo desmayado solo puede recuperarse con shake', () => {
    const org = new OrganismState('org-1');
    org.setEmotion('fainted');
    const eligible = getEligibleEvents({ self: org, other: null, relationship: null }, 0);
    assert.deepEqual(eligible, ['shake']);
  });

  it('las condiciones no cumplidas excluyen el evento', () => {
    const a = new OrganismState('A');
    const b = new OrganismState('B');
    const eligible = getEligibleEvents({ self: a, other: b, relationship: null }, 0);
    assert.ok(!eligible.includes('kiss'), 'kiss exige mutual_love');
    assert.ok(!eligible.includes('punch'), 'punch exige conflict');
  });

  it('devuelve eventos de a dos elegibles con compañero compatible', () => {
    const a = new OrganismState('A');
    const b = new OrganismState('B');
    a.setEmotion('attracted');
    b.setEmotion('shy');
    const eligible = getEligibleEvents({ self: a, other: b, relationship: null }, 0);
    assert.ok(eligible.includes('hug'), 'hug: al menos uno atraído');
    assert.ok(eligible.includes('reject'), 'reject: atraído vs tímido');
    assert.ok(eligible.includes('approach'), 'approach: ninguno desmayado');
    assert.ok(!eligible.includes('kiss'), 'kiss: sin mutual_love');
  });

  it('el compañero ocupado excluye los eventos de a dos', () => {
    const a = new OrganismState('A');
    const b = new OrganismState('B');
    a.setEmotion('attracted');
    b.setEmotion('attracted');
    b.startEvent('faint', { duration: 1000 }); // b ocupado
    const eligible = getEligibleEvents({ self: a, other: b, relationship: null }, 0);
    assert.ok(!eligible.includes('hug'));
    assert.ok(!eligible.includes('kiss'));
    assert.ok(!eligible.includes('approach'));
  });

  it('excluye eventos incompatibles con el evento activo del compañero', () => {
    const a = new OrganismState('A');
    const b = new OrganismState('B');
    a.setEmotion('attracted');
    b.setEmotion('attracted');
    a.startEvent('hug', { partnerId: 'B', duration: 1000 }); // A ocupado con hug
    const eligible = getEligibleEvents({ self: b, other: a, relationship: 'mutual_love' }, 0);
    assert.ok(!eligible.includes('punch'), 'punch incompatible con el hug activo de A');
    assert.ok(!eligible.includes('kiss'), 'kiss incompatible con el hug activo de A');
  });
});

// ---------------------------------------------------------------------------
// B03.3 — update (finalización de eventos y effects)
// ---------------------------------------------------------------------------

describe('B03.3 — update (finalización de eventos y effects)', () => {
  it('completa un evento cuando su duración termina', () => {
    const system = new Reacciones();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('nauseous');
    org.startEvent('faint', { duration: 1000, now: 0 });
    system.update(500);
    assert.equal(org.hasActiveEvent(), true, 'a los 500ms sigue activo');
    system.update(1000);
    assert.equal(org.hasActiveEvent(), false, 'a los 1000ms se completó');
  });

  it('aplica el efecto de emoción al finalizar (faint → fainted)', () => {
    const system = new Reacciones();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('nauseous');
    org.startEvent('faint', { duration: 1000, now: 0 });
    system.update(1000);
    assert.equal(org.emotion, 'fainted');
  });

  it('aplica el efecto de emoción al finalizar (shake → neutral)', () => {
    const system = new Reacciones();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('fainted');
    org.startEvent('shake', { duration: 1000, now: 0 });
    system.update(1000);
    assert.equal(org.emotion, 'neutral');
  });

  it('aplica el efecto de relación al finalizar (hug → mutual_love)', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.startEvent('hug', { partnerId: 'B', duration: 1000, now: 0 });
    system.update(1000);
    assert.equal(system.getRelationship('A', 'B'), 'mutual_love');
  });

  it('aplica el efecto de relación al finalizar (punch → conflict)', () => {
    const system = new Reacciones();
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.startEvent('punch', { partnerId: 'B', duration: 1000, now: 0 });
    system.update(1000);
    assert.equal(system.getRelationship('A', 'B'), 'conflict');
  });

  it('inicia cooldown al finalizar el evento', () => {
    const system = new Reacciones();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('nauseous');
    org.startEvent('faint', { duration: 1000, now: 0 });
    system.update(1000); // completa + cooldown
    assert.equal(org.canAct(1000), false, 'cooldown activo tras finalizar');
    assert.equal(org.canAct(1000 + EVENTS.faint.cooldown), true, 'puede actuar tras expirar el cooldown');
  });

  it('no aplica efectos antes de que termine el evento', () => {
    const system = new Reacciones();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('nauseous');
    org.startEvent('faint', { duration: 1000, now: 0 });
    system.update(500);
    assert.equal(org.emotion, 'nauseous', 'la emoción no cambió antes de terminar');
    assert.equal(org.hasActiveEvent(), true);
  });
});

// ---------------------------------------------------------------------------
// B03.4 — BehaviorEngine (integración)
// ---------------------------------------------------------------------------

function createEngine(options = {}) {
  const system = new Reacciones();
  const engine = new BehaviorEngine(system, { random: () => 0, minGap: 0, ...options });
  const directives = [];
  system.events.on('directive', (d) => directives.push(d));
  return { system, engine, directives };
}

describe('B03.4 — BehaviorEngine (integración)', () => {
  it('un organismo neutral ocioso inicia un evento automáticamente', () => {
    const { system, engine, directives } = createEngine();
    const org = system.registerOrganism({ id: 'org-1' });
    engine.update(0);
    assert.equal(org.hasActiveEvent(), true);
    assert.equal(org.activeEvent.eventId, 'limb_stretch');
    assert.equal(directives.length, 1);
    assert.equal(directives[0].phase, 'start');
    assert.equal(directives[0].behavior, 'limb_stretch');
    assert.equal(directives[0].organismId, 'org-1');
  });

  it('un evento de a dos vincula a ambos organismos', () => {
    const { system, engine, directives } = createEngine({ weights: { limb_stretch: 0 } });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    engine.update(0);
    assert.equal(a.activeEvent.eventId, 'approach');
    assert.equal(b.activeEvent.eventId, 'approach');
    assert.equal(a.partnerId, 'B');
    assert.equal(b.partnerId, 'A');
    assert.equal(directives.filter((d) => d.phase === 'start').length, 2);
  });

  it('las directivas tienen la estructura esperada por bodies.js', () => {
    const { system, engine, directives } = createEngine();
    system.registerOrganism({ id: 'org-1' });
    engine.update(0);
    const d = directives[0];
    assert.equal(typeof d.organismId, 'string');
    assert.equal(typeof d.behavior, 'string');
    assert.equal(d.phase, 'start');
    assert.equal(d.progress, 0);
    assert.equal(typeof d.params, 'object');
    assert.ok('partnerId' in d.params);
    assert.equal(typeof d.params.duration, 'number');
  });

  it('al completarse emite end e inicia cooldown', () => {
    const { system, engine, directives } = createEngine({ weights: { limb_stretch: 0 } });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    engine.update(0); // arranca approach (duración mínima 1000)
    assert.equal(a.activeEvent.eventId, 'approach');
    engine.update(1000); // completa approach
    assert.equal(a.hasActiveEvent(), false);
    assert.equal(b.hasActiveEvent(), false);
    const ends = directives.filter((d) => d.phase === 'end');
    assert.ok(ends.length >= 2, 'end por cada organismo');
    assert.ok(ends.every((d) => d.behavior === 'approach'));
    assert.equal(ends[0].phase, 'end');
    assert.equal(ends[0].progress, 1);
    assert.equal(typeof ends[0].organismId, 'string');
    assert.ok('partnerId' in ends[0].params, 'end incluye partnerId');
    assert.equal(a.canAct(1000), false, 'cooldown activo');
  });

  it('un abrazo completado establece enamoramiento mutuo', () => {
    const { system, engine } = createEngine({
      weights: { limb_stretch: 0, approach: 0, reject: 0 },
    });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    engine.update(0);
    assert.equal(a.activeEvent.eventId, 'hug');
    engine.update(3000); // hug dura mínimo 3000
    assert.equal(system.getRelationship('A', 'B'), 'mutual_love');
  });

  it('un organismo desmayado inicia shake para recuperarse', () => {
    const { system, engine } = createEngine();
    const org = system.registerOrganism({ id: 'org-1' });
    org.setEmotion('fainted');
    engine.update(0);
    assert.equal(org.activeEvent.eventId, 'shake');
  });

  it('respeta el intervalo mínimo entre decisiones', () => {
    const { system, engine } = createEngine({ minGap: 1000 });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    engine.update(0); // A inicia limb_stretch; B queda ocioso
    assert.equal(a.hasActiveEvent(), true);
    assert.equal(b.hasActiveEvent(), false);
    engine.update(500); // dentro del minGap: no hay nueva decisión
    assert.equal(b.hasActiveEvent(), false);
  });

  it('no inicia un evento de a dos si el compañero está ocupado', () => {
    const { system, engine } = createEngine({ weights: { limb_stretch: 0 } });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    a.startEvent('faint', { duration: 5000, now: 0 });
    engine.update(0);
    assert.equal(b.hasActiveEvent(), false);
  });

  it('la selección es determinista según random', () => {
    const { system, engine } = createEngine({ random: () => 0.5 });
    const a = system.registerOrganism({ id: 'A' });
    const b = system.registerOrganism({ id: 'B' });
    a.setEmotion('attracted');
    b.setEmotion('shy');
    engine.update(0);
    // candidatos: limb_stretch(A), limb_stretch(B), approach, hug, reject
    // total = 5; roll = 0.5 * 5 = 2.5 → approach
    assert.equal(a.activeEvent.eventId, 'approach');
  });
});
