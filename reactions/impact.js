import { CONFIG } from "../config.js";
import { chestOf, clamp } from "./geometry.js";

/**
 * The receiving side of a hit: knockback away from the punch, a dizzy sway,
 * rolling eyes and stars around the head for the duration of the reaction.
 *
 * A figure checks the companion's punch every frame against its own torso
 * hitbox. Once hit, it ignores new punches until the reaction ends.
 *
 * This is a consequence of the punch, not a scheduled reaction: it lives with
 * the figure that receives it.
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
