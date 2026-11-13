import { CONFIG } from "./config.js";

const EPSILON = 1e-6;

/**
 * Small random reactions each figure plays on its own.
 *
 * Every `intervalMs` the figure picks one reaction from the pool and loses
 * control of one limb for its duration; the rest of the body keeps following
 * the tracked pose. The first reaction is staggered by a random phase inside
 * the first window, so two people locked together do not react in lockstep.
 *
 * Reactions need a companion: the punch aims at the other participant's chest,
 * so a figure alone never reacts. Pure logic, no p5, no DOM.
 */
export class ReactionState {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.nextAt = null;
    this.active = null;
  }

  update(now, pose, companion, armLength = 1) {
    const config = CONFIG.figure.reactions;
    if (!config.enabled || now == null || !pose) {
      this.active = null;
      return null;
    }

    if (this.nextAt == null) {
      this.nextAt = now + this.random() * config.intervalMs;
    }

    if (this.active) {
      const duration = config[this.active.kind].durationMs;
      const progress = (now - this.active.startedAt) / duration;

      if (progress >= 1) {
        this.active = null;
      } else {
        this.active.extension = punchExtension(progress);
        this.active.shoulder = currentShoulder(pose, this.active);
        return this.active;
      }
    }

    if (now < this.nextAt) return null;

    this.nextAt = now + config.intervalMs;
    this.active = this.start(now, pose, companion, armLength);
    return this.active;
  }

  /** One reaction per window, picked at random from the configured pool. */
  start(now, pose, companion, armLength) {
    const pool = CONFIG.figure.reactions.pool ?? [];
    if (pool.length === 0) return null;

    const index = Math.min(
      pool.length - 1,
      Math.floor(this.random() * pool.length)
    );
    const kind = pool[index];

    if (kind === "punch") {
      return this.startPunch(now, pose, companion, armLength);
    }
    return null;
  }

  /**
   * The punch extends the arm on the companion's side as if hitting them. The
   * arm is frozen: direction, side and segment lengths are read once when the
   * reaction starts, so tracking noise cannot bend the punch mid-flight.
   */
  startPunch(now, pose, companion, armLength) {
    const chest = chestOf(pose);
    const target = chestOf(companion);
    if (!chest || !target) return null;

    const side = punchSide(pose, chest, target);
    if (!side) return null;

    const shoulder = pose.get(`${side}_shoulder`);
    const direction = normalize(target.x - shoulder.x, target.y - shoulder.y);
    if (!direction) return null;

    const base = Math.max(1, pose.scale || 1);
    const { upperFallback, forearmFallback } = CONFIG.figure.reactions.punch;
    const elbow = pose.isVisible(`${side}_elbow`)
      ? pose.get(`${side}_elbow`)
      : null;
    const wrist = pose.isVisible(`${side}_wrist`)
      ? pose.get(`${side}_wrist`)
      : null;

    return {
      kind: "punch",
      side,
      startedAt: now,
      extension: 0,
      shoulder: { x: shoulder.x, y: shoulder.y },
      direction,
      base,
      // The figure's own arm length is baked in here, so the fist used for
      // hit detection is exactly the drawn fist.
      upperLength:
        (elbow ? distance(shoulder, elbow) : base * upperFallback) * armLength,
      forearmLength:
        (elbow && wrist ? distance(elbow, wrist) : base * forearmFallback) *
        armLength,
    };
  }

  /** The active punch's fist at `now`, for hit detection. Null when none. */
  fistAt(now) {
    const active = this.active;
    if (!active || active.kind !== "punch" || now == null) return null;

    const duration = CONFIG.figure.reactions.punch.durationMs;
    const progress = (now - active.startedAt) / duration;
    if (!(progress >= 0) || progress >= 1) return null;

    const extension = punchExtension(progress);
    if (extension < 0.02) return null;

    const hand = punchPoints(active, extension).hand;
    return {
      x: hand.x,
      y: hand.y,
      direction: active.direction,
      base: active.base,
    };
  }
}

/**
 * The receiving side of a hit: knockback away from the punch, a dizzy sway,
 * rolling eyes and stars around the head for the duration of the reaction.
 *
 * A figure checks the companion's punch every frame against its own torso
 * hitbox. Once hit, it ignores new punches until the reaction ends.
 */
export class ImpactState {
  constructor() {
    this.hitAt = null;
    this.direction = { x: 0, y: 0 };
    this.base = 1;
  }

  update(now, pose, attacker) {
    const config = CONFIG.figure.impact;
    if (now == null) return null;

    if (this.hitAt != null) {
      const elapsed = now - this.hitAt;
      if (elapsed < config.durationMs) return this.frame(elapsed);
      this.hitAt = null;
    }

    if (!attacker || typeof attacker.punchFist !== "function") return null;

    const fist = attacker.punchFist(now);
    if (!fist || !fistTouchesBody(fist, pose)) return null;

    this.hitAt = now;
    this.direction = { ...fist.direction };
    this.base = Math.max(1, pose.scale || 1);
    return this.frame(0);
  }

  frame(elapsed) {
    const config = CONFIG.figure.impact;
    const direction = this.direction;
    const base = this.base;
    const progress = clamp(elapsed / config.durationMs, 0, 1);
    const pushPhase = Math.min(1, elapsed / config.knockbackMs);
    const push = config.knockback * base * Math.sin(Math.PI * pushPhase);
    const swayRadius = config.sway * base * (1 - progress);
    const swayAngle = (elapsed / 1000) * config.swaySpeed;

    return {
      elapsed,
      offset: {
        x: direction.x * push + Math.cos(swayAngle) * swayRadius,
        y: direction.y * push + Math.sin(swayAngle) * swayRadius,
      },
      eyeTilt:
        Math.sin((elapsed / 1000) * config.eyeSpeed) *
        config.eyeTilt *
        (1 - progress),
    };
  }
}

/**
 * Does a fist circle overlap the torso hitbox? The hitbox is a circle around
 * the victim's chest, proportional to the body scale.
 */
export function fistTouchesBody(fist, pose) {
  const chest = chestOf(pose);
  if (!fist || !chest) return false;

  const base = Math.max(1, pose.scale || 1);
  const bodyRadius = base * CONFIG.figure.impact.hitboxRadius;

  return (
    Math.hypot(fist.x - chest.x, fist.y - chest.y) <=
    fist.radius + bodyRadius
  );
}

/** Elbow and fist of a punch at a given extension, along the frozen line. */
export function punchPoints(active, extension) {
  const shoulder = active.shoulder;
  const direction = active.direction;
  const upperReach = active.upperLength * extension;
  const forearmReach = active.forearmLength * extension;
  const elbow = {
    x: shoulder.x + direction.x * upperReach,
    y: shoulder.y + direction.y * upperReach,
  };
  const hand = {
    x: elbow.x + direction.x * forearmReach,
    y: elbow.y + direction.y * forearmReach,
  };

  return { elbow, hand };
}

/**
 * Arm extension over the reaction, in 0..1 of the arm's full length.
 *
 * A short hold, a fast punchy strike with a slight overshoot, a settle and a
 * smooth retract. At full extension the arm is straight, so the fist lands
 * one whole arm away from the shoulder.
 */
function punchExtension(progress) {
  if (progress < 0.1) return 0;

  if (progress < 0.45) {
    const t = (progress - 0.1) / 0.35;
    return 1.12 * (1 - (1 - t) ** 3);
  }

  if (progress < 0.7) {
    const t = (progress - 0.45) / 0.25;
    return 1.12 + (1 - 1.12) * t;
  }

  const t = (progress - 0.7) / 0.3;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * The arm on the companion's side, chosen by geometry and not by the
 * anatomical label: MoveNet can swap left and right.
 */
function punchSide(pose, chest, target) {
  const visible = ["left", "right"].filter((side) =>
    pose.isVisible(`${side}_shoulder`)
  );
  if (visible.length === 0) return null;

  const shoulders = visible
    .map((side) => ({ side, point: pose.get(`${side}_shoulder`) }))
    .sort((a, b) => a.point.x - b.point.x);

  // Companion on the right means the rightmost shoulder, and vice versa.
  return target.x > chest.x
    ? shoulders[shoulders.length - 1].side
    : shoulders[0].side;
}

function currentShoulder(pose, active) {
  const name = `${active.side}_shoulder`;
  if (!pose.isVisible(name)) return active.shoulder;

  const point = pose.get(name);
  return { x: point.x, y: point.y };
}

/** Chest midpoint, or the torso centre when a shoulder is hidden. */
function chestOf(pose) {
  if (!pose) return null;

  if (pose.isVisible("left_shoulder") && pose.isVisible("right_shoulder")) {
    const left = pose.get("left_shoulder");
    const right = pose.get("right_shoulder");
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }

  return pose.center ?? null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < EPSILON) return null;
  return { x: x / length, y: y / length };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
