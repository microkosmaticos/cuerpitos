import { CONFIG } from "../config.js";
import { REACTION_LIBRARY } from "./library.js";

/**
 * One scene-level director for the whole pair.
 *
 * Every `intervalMs` it picks ONE reaction from the library and plays it. There
 * is never more than one active reaction: the next window does not open until
 * the interval has passed, and a new reaction cannot start while one is
 * running. Reactions that need both people only start when two valid
 * participants are present.
 */
export class ReactionDirector {
  constructor({ random = Math.random, library = REACTION_LIBRARY } = {}) {
    this.random = random;
    this.library = library;
    this.nextAt = null;
    this.active = null;
  }

  /**
   * Advances the schedule. Returns the active reaction, or null. Call once per
   * frame with the participants that are on stage.
   */
  update(now, participants, scene = null) {
    const config = CONFIG.figure.reactions;
    if (!config.enabled || now == null) {
      this.active = null;
      return null;
    }

    const ready = (participants ?? []).filter(
      (participant) =>
        participant?.pose &&
        participant?.figure &&
        participant.state !== "ABSENT"
    );

    if (this.active) {
      const elapsed = now - this.active.startedAt;
      if (elapsed < this.active.durationMs && ready.length >= 2) {
        return this.active;
      }
      this.active = null;
    }

    if (ready.length < 2) return null;

    if (this.nextAt == null) {
      this.nextAt = now + this.random() * config.intervalMs;
    }

    if (now < this.nextAt) return null;

    this.nextAt = now + config.intervalMs;
    this.active = this.start(now, ready, scene);
    return this.active;
  }

  start(now, participants, scene) {
    if (this.library.length === 0) return null;

    const index = Math.min(
      this.library.length - 1,
      Math.floor(this.random() * this.library.length)
    );
    const definition = this.library[index];
    const started = definition.start(now, {
      participants,
      random: this.random,
      scene,
    });
    if (!started) return null;

    return {
      id: definition.id,
      definition,
      startedAt: now,
      durationMs: definition.durationMs,
      participants,
      ...started,
    };
  }

  /**
   * The reaction a figure must render. Only the punch has a body owner; the
   * heart is a scene prop, so it returns null for every figure. Participants
   * are recreated every frame, so the owner is matched by its stable slot.
   */
  reactionFor(participant) {
    if (!this.active || this.active.id !== "punch") return null;
    if (this.active.attacker?.slotId == null || participant?.slotId == null) {
      return null;
    }
    return this.active.attacker.slotId === participant.slotId
      ? this.active
      : null;
  }

  /** Scene props (the heart) plus the palette that owns them. */
  props(now) {
    if (!this.active || typeof this.active.definition.propsAt !== "function") {
      return { shapes: [], colors: null };
    }

    return {
      shapes: this.active.definition.propsAt(now, this.active.state),
      colors: this.active.state.palette ?? null,
    };
  }
}
