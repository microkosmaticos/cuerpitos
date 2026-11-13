import { CONFIG } from "../config.js";
import { chestOf, distance, normalize } from "./geometry.js";

/**
 * Punch reaction library.
 *
 * One participant (the attacker) loses control of the arm on the companion's
 * side and extends it straight towards the other chest. Side, direction and
 * segment lengths are frozen when the reaction starts; tracking noise never
 * bends the punch mid-flight.
 *
 * The director owns the lifecycle. This module only knows how to build and
 * sample one punch.
 */
export const punchReaction = {
  id: "punch",
  durationMs: CONFIG.figure.reactions.punch.durationMs,

  /** Pick the attacker and freeze the punch geometry. */
  start(now, { participants, random }) {
    if (!participants || participants.length < 2) return null;

    const attackerIndex = random() < 0.5 ? 0 : 1;
    const attacker = participants[attackerIndex];
    const target = participants[1 - attackerIndex];
    const mine = chestOf(attacker.pose);
    const theirs = chestOf(target.pose);
    if (!mine || !theirs) return null;

    const side = punchSide(attacker.pose, mine, theirs);
    if (!side) return null;

    const shoulder = attacker.pose.get(`${side}_shoulder`);
    const direction = normalize(theirs.x - shoulder.x, theirs.y - shoulder.y);
    if (!direction) return null;

    const base = Math.max(1, attacker.pose.scale || 1);
    const armLength = attacker.figure?.proportions?.armLength ?? 1;
    const { upperFallback, forearmFallback } = CONFIG.figure.reactions.punch;
    const elbow = attacker.pose.isVisible(`${side}_elbow`)
      ? attacker.pose.get(`${side}_elbow`)
      : null;
    const wrist = attacker.pose.isVisible(`${side}_wrist`)
      ? attacker.pose.get(`${side}_wrist`)
      : null;

    return {
      attacker,
      state: {
        startedAt: now,
        side,
        shoulder: { x: shoulder.x, y: shoulder.y },
        direction,
        base,
        // The figure's own arm length is baked in here, so the fist used for
        // hit detection is exactly the drawn fist.
        upperLength:
          (elbow ? distance(shoulder, elbow) : base * upperFallback) *
          armLength,
        forearmLength:
          (elbow && wrist ? distance(elbow, wrist) : base * forearmFallback) *
          armLength,
      },
    };
  },

  /** Elbow and fist at `now`, or null while the arm is still retracted. */
  pointsAt(now, state, pose) {
    const extension = extensionAt(now, state);
    if (extension < 0.02) return null;

    state.shoulder = currentShoulder(pose, state);
    const { elbow, hand } = punchPoints(state, extension);

    return { shoulder: { ...state.shoulder }, elbow, hand };
  },

  /** The fist circle for hit detection, or null when there is no punch. */
  fistAt(now, state) {
    const extension = extensionAt(now, state);
    if (extension < 0.02) return null;

    const hand = punchPoints(state, extension).hand;
    return {
      x: hand.x,
      y: hand.y,
      direction: state.direction,
      base: state.base,
    };
  },
};

function extensionAt(now, state) {
  const progress =
    (now - state.startedAt) / CONFIG.figure.reactions.punch.durationMs;
  if (!(progress >= 0) || progress >= 1) return 0;

  return punchExtension(progress);
}

/**
 * Arm extension over the reaction, in 0..1 of the arm's full length.
 *
 * A short hold, a fast punchy strike with a slight overshoot, a settle and a
 * smooth retract.
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

/** Elbow and fist of a punch at a given extension, along the frozen line. */
export function punchPoints(state, extension) {
  const shoulder = state.shoulder;
  const direction = state.direction;
  const upperReach = state.upperLength * extension;
  const forearmReach = state.forearmLength * extension;
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

  return target.x > chest.x
    ? shoulders[shoulders.length - 1].side
    : shoulders[0].side;
}

function currentShoulder(pose, state) {
  const name = `${state.side}_shoulder`;
  if (!pose.isVisible(name)) return state.shoulder;

  const point = pose.get(name);
  return { x: point.x, y: point.y };
}
