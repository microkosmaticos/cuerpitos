/** Small geometry helpers shared by every reaction library. */

const EPSILON = 1e-6;

/** Chest midpoint, or the torso centre when a shoulder is hidden. */
export function chestOf(pose) {
  if (!pose) return null;

  if (pose.isVisible("left_shoulder") && pose.isVisible("right_shoulder")) {
    const left = pose.get("left_shoulder");
    const right = pose.get("right_shoulder");
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }

  return pose.center ?? null;
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < EPSILON) return null;
  return { x: x / length, y: y / length };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic 0..1 noise so particles vary without storing state. */
export function variation(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
