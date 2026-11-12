import { CONFIG } from "./config.js";

/**
 * Generative geometric body.
 *
 * A figure replaces the visible body parts of a tracked participant. It keeps
 * the pose motion, but not the pose proportions: every participant rolls its
 * own girth, arm length and head size once, and the figure stretches the
 * detected limbs to match. All shapes are returned in video coordinates, so
 * the mirror stays a view concern.
 *
 * Pure logic: no p5, no ml5, no DOM.
 */

const EPSILON = 1e-6;

/** Deterministic PRNG (mulberry32), so a body can be reproduced from its seed. */
export class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;

    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  float(min, max) {
    return min + (max - min) * this.next();
  }
}

/**
 * One body plan. Built when a participant is locked and kept for its whole
 * session, including temporary occlusion.
 *
 * - girth: width multiplier for chest, arms and shoulders (thin .. wide).
 * - armLength: multiplies both arm segments along the detected direction.
 * - headSize: head radius as a fraction of the detected shoulder width.
 * - size: whole-body scale around the chest (small .. large character).
 */
export class FigureProportions {
  constructor({ seed, girth, armLength, headSize, size = 1 }) {
    this.seed = seed >>> 0;
    this.girth = girth;
    this.armLength = armLength;
    this.headSize = headSize;
    this.size = size;
  }

  static create(seed, ranges = CONFIG.figure.proportions) {
    const random = new SeededRandom(seed);

    return new FigureProportions({
      seed,
      girth: random.float(ranges.girth[0], ranges.girth[1]),
      armLength: random.float(ranges.armLength[0], ranges.armLength[1]),
      headSize: random.float(ranges.headSize[0], ranges.headSize[1]),
      size: random.float(ranges.size[0], ranges.size[1]),
    });
  }

  static random(ranges = CONFIG.figure.proportions) {
    return FigureProportions.create(
      Math.floor(Math.random() * 0xffffffff),
      ranges
    );
  }
}

const EYE_SIDES = ["left", "right"];

/**
 * Eye positions plus an autonomous blink.
 *
 * MoveNet tracks the eye centre, not the eyelids, so the tracking is only used
 * to read the position and the eye-axis angle. The lids never react to
 * keypoint confidence or loss (that deformed the ovals); the only blink is the
 * scheduled one, once every `autoBlinkMs`.
 */
class EyeExpression {
  constructor() {
    this.state = {
      left: this.createState(),
      right: this.createState(),
    };
    this.angle = 0;
    this.updatedAt = null;
    this.openness = 1;
    this.nextAutoBlinkAt = null;
    this.autoBlinkUntil = null;
  }

  createState() {
    return { x: null, y: null, lastSeenAt: null };
  }

  update(pose, now) {
    const config = CONFIG.figure.eyes;
    const minConfidence = CONFIG.skeleton.minConfidence;
    const dt = this.deltaSeconds(now);
    if (now != null) this.updatedAt = now;

    const visible = { left: null, right: null };

    for (const side of EYE_SIDES) {
      const state = this.state[side];
      const point = pose.get(`${side}_eye`);
      const confidence = point ? point.confidence ?? 0 : 0;
      const isVisible = Boolean(point) && confidence >= minConfidence;

      // Only the position is read from the tracking. Confidence never changes
      // the shape of the eye, so the ovals cannot deform with tracking noise.
      if (isVisible) {
        state.x = point.x;
        state.y = point.y;
        state.lastSeenAt = now ?? state.lastSeenAt;
        visible[side] = point;
      } else if (
        now != null &&
        state.lastSeenAt != null &&
        now - state.lastSeenAt > config.forgetMs
      ) {
        state.x = null;
        state.y = null;
      }
    }

    if (visible.left && visible.right) {
      const dx = visible.right.x - visible.left.x;
      const dy = visible.right.y - visible.left.y;
      this.angle = Math.atan2(dy, dx);
    }

    // The only thing that opens and closes the lids is the autonomous blink.
    const target = this.updateAutoBlink(now) ? 0 : 1;
    const tau = target < this.openness ? config.closeTime : config.openTime;
    this.openness = approach(this.openness, target, dt, tau);
  }

  /**
   * Autonomous idle blink: returns true while the scheduled blink keeps the
   * lids closed, so the figure blinks on its own even when the tracking never
   * loses the eyes.
   */
  updateAutoBlink(now) {
    const { autoBlinkMs, autoBlinkHoldMs } = CONFIG.figure.eyes;
    if (now == null || !(autoBlinkMs > 0)) return false;

    if (this.nextAutoBlinkAt == null) {
      this.nextAutoBlinkAt = now + autoBlinkMs;
      return false;
    }

    if (this.autoBlinkUntil != null) {
      if (now < this.autoBlinkUntil) return true;
      this.autoBlinkUntil = null;
    }

    if (now < this.nextAutoBlinkAt) return false;

    this.autoBlinkUntil = now + autoBlinkHoldMs;
    this.nextAutoBlinkAt += autoBlinkMs;
    // Do not fire a burst after a long pause (tab hidden, slow frame).
    if (this.nextAutoBlinkAt <= now) this.nextAutoBlinkAt = now + autoBlinkMs;

    return true;
  }

  deltaSeconds(now) {
    if (now == null || this.updatedAt == null) return 0;
    return Math.min(0.25, Math.max(0, (now - this.updatedAt) / 1000));
  }

  shapes(headRadius) {
    const ratios = CONFIG.figure.ratios;
    const eyes = CONFIG.figure.eyes;
    const rx = headRadius * ratios.eyeWidth;
    const openRy = headRadius * ratios.eyeHeight;

    return EYE_SIDES.map((side) => this.state[side])
      .filter((state) => state.x != null && state.y != null)
      .map((state) =>
        eyeAt(
          { x: state.x, y: state.y },
          rx,
          openRy * Math.max(this.openness, eyes.closedHeight),
          this.angle,
          CONFIG.figure.eyeColor
        )
      );
  }
}

function approach(current, target, dt, tau) {
  if (!(dt > 0) || !(tau > 0)) return current;

  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/**
 * Geometric body for one pose.
 *
 * Shapes:
 *   rectangle  between shoulder and elbow, and between elbow and wrist.
 *   rectangle  chest/torso, between the shoulder line and the hips.
 *   circle     head, plus one per shoulder, per elbow and per hand.
 *   ellipse    two black oval eyes on the tracked eye keypoints, with an
 *              autonomous blink every `autoBlinkMs`.
 *
 * The elbow circle follows the stretched arm, so it always covers the bend
 * where the two rectangles meet.
 *
 * Limb length is the detected segment length times `armLength`; the segments
 * stay chained, so a short-armed body still connects shoulder to hand.
 *
 * The whole body is finally scaled by `size` around the chest, so a small
 * character and a large one can stand in the same spot without the figure
 * drifting away from the person.
 */
export class GeometricFigure {
  constructor(proportions) {
    this.proportions = proportions;
    this.eyes = new EyeExpression();
  }

  shapes(pose, now = null) {
    if (!pose) return [];

    const base = Math.max(1, pose.scale || 1);
    const shapes = [];

    const chest = this.chestShape(pose, base);
    if (chest) shapes.push(chest);

    const leftArm = this.armParts(pose, "left", base);
    const rightArm = this.armParts(pose, "right", base);

    if (leftArm) shapes.push(...leftArm.segments);
    if (rightArm) shapes.push(...rightArm.segments);

    shapes.push(...this.jointShapes(pose, base, [leftArm, rightArm]));

    const head = this.headShape(pose, base);
    if (head) {
      shapes.push(head);
      // Eyes only make sense on a head, and they ride on top of it.
      shapes.push(...this.eyeShapes(pose, base, now));
    }

    return this.scaleShapes(shapes, this.anchor(pose), this.proportions.size);
  }

  /** Scaling anchor: the chest, or the torso centre when shoulders are hidden. */
  anchor(pose) {
    const left = this.visiblePoint(pose, "left_shoulder");
    const right = this.visiblePoint(pose, "right_shoulder");
    if (left && right) return midpoint(left, right);

    return pose.center ?? { x: 0, y: 0 };
  }

  /**
   * Scales positions and dimensions together: this is the whole pose coordinate
   * system growing or shrinking, not just thicker limbs.
   */
  scaleShapes(shapes, anchor, size) {
    if (!Number.isFinite(size) || size === 1) return shapes;

    return shapes.map((shape) => {
      const scaled = {
        ...shape,
        x: anchor.x + (shape.x - anchor.x) * size,
        y: anchor.y + (shape.y - anchor.y) * size,
      };

      if (shape.kind === "circle") {
        scaled.radius = shape.radius * size;
      } else if (shape.kind === "ellipse") {
        scaled.rx = shape.rx * size;
        scaled.ry = shape.ry * size;
      } else {
        scaled.length = shape.length * size;
        scaled.thickness = shape.thickness * size;
        scaled.radius = shape.radius * size;
      }

      return scaled;
    });
  }

  chestShape(pose, base) {
    const leftShoulder = this.visiblePoint(pose, "left_shoulder");
    const rightShoulder = this.visiblePoint(pose, "right_shoulder");
    if (!leftShoulder || !rightShoulder) return null;

    const thickness =
      base * this.proportions.girth * CONFIG.figure.ratios.chestThickness;
    const chest = midpoint(leftShoulder, rightShoulder);

    const leftHip = this.visiblePoint(pose, "left_hip");
    const rightHip = this.visiblePoint(pose, "right_hip");
    if (leftHip && rightHip) {
      const torso = rectangleBetween(
        chest,
        midpoint(leftHip, rightHip),
        thickness
      );
      if (torso) return torso;
    }

    // Waist-up framing without visible hips: hang the torso below the chest.
    const length = base * CONFIG.figure.ratios.chestLength;
    return {
      kind: "rectangle",
      x: chest.x,
      y: chest.y + length / 2,
      length,
      thickness,
      radius: cornerRadius(length, thickness),
      angle: Math.PI / 2,
    };
  }

  armParts(pose, side, base) {
    const shoulder = this.visiblePoint(pose, `${side}_shoulder`);
    const elbow = this.visiblePoint(pose, `${side}_elbow`);
    if (!shoulder || !elbow) return null;

    const { girth, armLength } = this.proportions;
    const upperVector = stretch(shoulder, elbow, armLength);
    if (!upperVector) return null;

    const upperEnd = {
      x: shoulder.x + upperVector.x,
      y: shoulder.y + upperVector.y,
    };
    const segments = [
      rectangleBetween(
        shoulder,
        upperEnd,
        base * girth * CONFIG.figure.ratios.upperArmThickness
      ),
    ];

    const wrist = this.visiblePoint(pose, `${side}_wrist`);
    const forearmVector = wrist ? stretch(elbow, wrist, armLength) : null;
    let hand = null;

    if (forearmVector) {
      // The forearm follows the detected elbow->wrist direction, but starts
      // where the stretched upper arm ended.
      const forearmEnd = {
        x: upperEnd.x + forearmVector.x,
        y: upperEnd.y + forearmVector.y,
      };
      segments.push(
        rectangleBetween(
          upperEnd,
          forearmEnd,
          base * girth * CONFIG.figure.ratios.forearmThickness
        )
      );
      hand = forearmEnd;
    }

    return { segments, elbow: upperEnd, hand };
  }

  /** Joints sit on top of the rectangles: shoulders, elbows and hands. */
  jointShapes(pose, base, arms) {
    const girth = this.proportions.girth;
    const shoulderRadius = base * girth * CONFIG.figure.ratios.shoulderRadius;
    const elbowRadius = base * girth * CONFIG.figure.ratios.elbowRadius;
    const handRadius = base * girth * CONFIG.figure.ratios.handRadius;
    const shapes = [];

    for (const side of ["left", "right"]) {
      const point = this.visiblePoint(pose, `${side}_shoulder`);
      if (point) shapes.push(circleAt(point, shoulderRadius));
    }

    for (const arm of arms) {
      if (!arm) continue;
      shapes.push(circleAt(arm.elbow, elbowRadius));
      // The hand is the end of the stretched forearm, not a finger keypoint.
      if (arm.hand) shapes.push(circleAt(arm.hand, handRadius));
    }

    return shapes;
  }

  headShape(pose, base) {
    const center = pose.headCenter();
    if (!center) return null;

    return circleAt(center, base * this.proportions.headSize);
  }

  /**
   * Oval eyes driven by the eye tracking. `now` (milliseconds) advances the
   * blink/squint animation; without it the eyes keep their current openness.
   */
  eyeShapes(pose, base, now) {
    this.eyes.update(pose, now);

    return this.eyes.shapes(base * this.proportions.headSize);
  }

  visiblePoint(pose, name) {
    return pose.isVisible(name) ? pose.get(name) : null;
  }
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function stretch(start, end, factor) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) < EPSILON) return null;

  return { x: dx * factor, y: dy * factor };
}

/**
 * Rectangle centred between two points, its long axis along the segment.
 * `length` runs along the bone; `thickness` is across it.
 */
function rectangleBetween(start, end, thickness) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < EPSILON) return null;

  return {
    kind: "rectangle",
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    length,
    thickness,
    radius: cornerRadius(length, thickness),
    angle: Math.atan2(dy, dx),
  };
}

/** Soft corners keep the rectangles in the same family as circles and ovals. */
function cornerRadius(length, thickness) {
  return Math.min(length, thickness) * CONFIG.figure.cornerRatio;
}

function circleAt(center, radius) {
  return { kind: "circle", x: center.x, y: center.y, radius };
}

function eyeAt(center, rx, ry, angle, fill) {
  return { kind: "ellipse", x: center.x, y: center.y, rx, ry, angle, fill };
}
