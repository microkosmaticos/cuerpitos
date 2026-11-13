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
 * - accessory: one random prop, rolled at birth ("flower", "hat" or
 *   "necklace"), kept for the whole session.
 * - palette: random body (bone) and accent (joint) colours with guaranteed
 *   contrast for the eyes and the accessories.
 */
export class FigureProportions {
  constructor({
    seed,
    girth,
    armLength,
    headSize,
    size = 1,
    accessory = null,
    palette = DEFAULT_PALETTE,
  }) {
    this.seed = seed >>> 0;
    this.girth = girth;
    this.armLength = armLength;
    this.headSize = headSize;
    this.size = size;
    this.accessory = accessory;
    this.palette = palette;
  }

  static create(seed, ranges = CONFIG.figure.proportions) {
    const random = new SeededRandom(seed);
    const accessories = CONFIG.figure.accessories ?? [];

    return new FigureProportions({
      seed,
      girth: random.float(ranges.girth[0], ranges.girth[1]),
      armLength: random.float(ranges.armLength[0], ranges.armLength[1]),
      headSize: random.float(ranges.headSize[0], ranges.headSize[1]),
      size: random.float(ranges.size[0], ranges.size[1]),
      accessory:
        accessories.length > 0
          ? accessories[Math.floor(random.next() * accessories.length)]
          : null,
      palette: createPalette(random),
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

/** Fallback palette for figures built without a rolled palette. */
const DEFAULT_PALETTE = Object.freeze({ bone: "#5ef2ff", joint: "#c6fbff" });

/**
 * One random palette per body.
 *
 * The body colour is lifted until it clears `minBodyLuminance`, so the black
 * eyes always read. The accent colour uses a distant hue and is lifted until
 * it is clearly brighter than the body, so hats, flowers, necklaces and the
 * body outline pop.
 */
function createPalette(random) {
  const ranges = CONFIG.figure.palette;
  const hue = random.float(0, 360);
  const spread = random.float(ranges.hueSpread[0], ranges.hueSpread[1]);
  const saturation = random.float(ranges.saturation[0], ranges.saturation[1]);
  const bodyLightness = random.float(
    ranges.bodyLightness[0],
    ranges.bodyLightness[1]
  );
  const accentLightness = random.float(
    ranges.accentLightness[0],
    ranges.accentLightness[1]
  );

  const bone = liftLuminance(
    hue,
    saturation,
    bodyLightness,
    ranges.minBodyLuminance,
    0.85
  );
  const joint = liftLuminance(
    (hue + spread) % 360,
    saturation,
    accentLightness,
    relativeLuminance(bone.hex) + ranges.minAccentLuminanceGap,
    0.97
  );

  // A very bright body (yellow, lime) leaves no room for an even brighter
  // accent: darken the body just enough to restore the gap.
  let bodyHex = bone.hex;
  let bodyLevel = bone.lightness;

  while (
    relativeLuminance(joint.hex) - relativeLuminance(bodyHex) <
      ranges.minAccentLuminanceGap &&
    bodyLevel > 0.2
  ) {
    bodyLevel -= 0.02;
    const candidate = hslToHex(hue, saturation, bodyLevel);
    if (relativeLuminance(candidate) < ranges.minBodyLuminance) break;
    bodyHex = candidate;
  }

  return { bone: bodyHex, joint: joint.hex };
}

/** HSL (0-360, 0-1, 0-1) to #rrggbb. */
function hslToHex(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;

  let rgb;
  if (h < 60) rgb = [chroma, x, 0];
  else if (h < 120) rgb = [x, chroma, 0];
  else if (h < 180) rgb = [0, chroma, x];
  else if (h < 240) rgb = [0, x, chroma];
  else if (h < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  const hex = rgb
    .map((value) =>
      Math.round((value + m) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

  return `#${hex}`;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Raises the HSL lightness until the colour clears `minLuminance`. */
function liftLuminance(hue, saturation, lightness, minLuminance, maxLightness) {
  let current = lightness;
  let hex = hslToHex(hue, saturation, current);

  while (relativeLuminance(hex) < minLuminance && current < maxLightness) {
    current = Math.min(maxLightness, current + 0.02);
    hex = hslToHex(hue, saturation, current);
  }

  return { hex, lightness: current };
}

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

    shapes.push(...this.accessoryShapes(pose, base));

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

  /**
   * One random prop per body, built from the same vocabulary as the figure:
   * circles, ovals and rounded rectangles, in the accent half of the palette.
   */
  accessoryShapes(pose, base) {
    switch (this.proportions.accessory) {
      case "hat":
        return this.hatShapes(pose, base);
      case "necklace":
        return this.necklaceShapes(pose, base);
      case "flower":
        return this.flowerShapes(pose, base);
      default:
        return [];
    }
  }

  /** Local frame of the head: centre, eye-axis direction and head "up". */
  headFrame(pose) {
    const center = pose.headCenter();
    if (!center) return null;

    const angle = this.eyes.angle;
    const axis = { x: Math.cos(angle), y: Math.sin(angle) };
    // The eye axis is a line, not a vector: MoveNet can return left_eye to the
    // right of right_eye, which flips the sign. Pick the perpendicular that
    // points to the top of the image so hats and flowers never hang below the
    // head.
    let up = { x: -axis.y, y: axis.x };
    if (up.y > 0) up = { x: -up.x, y: -up.y };

    return { center, angle, axis, up };
  }

  /** A flower on one upper corner of the head. */
  flowerShapes(pose, base) {
    const frame = this.headFrame(pose);
    if (!frame) return [];

    const radius = base * this.proportions.headSize;
    const center = offsetPoint(
      frame.center,
      frame.axis,
      frame.up,
      radius * 0.55,
      radius * 0.55
    );
    const petals = 5;
    const shapes = [];

    for (let i = 0; i < petals; i += 1) {
      const angle = (i / petals) * Math.PI * 2;
      shapes.push(
        circleAt(
          {
            x: center.x + Math.cos(angle) * radius * 0.22,
            y: center.y + Math.sin(angle) * radius * 0.22,
          },
          radius * 0.16,
          true
        )
      );
    }

    shapes.push(circleAt(center, radius * 0.11, false, CONFIG.figure.eyeColor));
    return shapes;
  }

  /** A crown and a brim, rounded rectangles sitting on top of the head. */
  hatShapes(pose, base) {
    const frame = this.headFrame(pose);
    if (!frame) return [];

    const radius = base * this.proportions.headSize;
    const brimCenter = offsetPoint(
      frame.center,
      frame.axis,
      frame.up,
      0,
      radius * 0.8
    );
    const crownCenter = offsetPoint(
      frame.center,
      frame.axis,
      frame.up,
      0,
      radius * 1.1
    );

    const brim = rectangleBetween(
      offsetPoint(brimCenter, frame.axis, frame.up, -radius * 0.95, 0),
      offsetPoint(brimCenter, frame.axis, frame.up, radius * 0.95, 0),
      radius * 0.16
    );
    const crown = rectangleBetween(
      offsetPoint(crownCenter, frame.axis, frame.up, -radius * 0.52, 0),
      offsetPoint(crownCenter, frame.axis, frame.up, radius * 0.52, 0),
      radius * 0.55
    );

    return [crown, brim]
      .filter(Boolean)
      .map((shape) => ({ ...shape, accent: true }));
  }

  /**
   * A half circle of small pearls over the chest: the two ends rest at chest
   * level and the middle pearl closes the arc at the bottom, like a string of
   * pearls.
   */
  necklaceShapes(pose, base) {
    const left = this.visiblePoint(pose, "left_shoulder");
    const right = this.visiblePoint(pose, "right_shoulder");
    if (!left || !right) return [];

    const chest = midpoint(left, right);
    const angle = Math.atan2(right.y - left.y, right.x - left.x);
    const axis = { x: Math.cos(angle), y: Math.sin(angle) };
    // The shoulder line is a line too: force "down" towards the bottom of the
    // image so the arc sits over the chest, never on the neck.
    let down = { x: -axis.y, y: axis.x };
    if (down.y < 0) down = { x: -down.x, y: -down.y };

    const center = {
      x: chest.x + down.x * base * 0.05,
      y: chest.y + down.y * base * 0.05,
    };
    const arcRadius = base * 0.24;
    const pearlRadius = base * 0.035;
    const pearls = 11;

    return Array.from({ length: pearls }, (_, index) => {
      // 0 and PI are the ends of the diameter; PI / 2 is the bottom pearl.
      const step = (index / (pearls - 1)) * Math.PI;

      return circleAt(
        {
          x:
            center.x +
            axis.x * Math.cos(step) * arcRadius +
            down.x * Math.sin(step) * arcRadius,
          y:
            center.y +
            axis.y * Math.cos(step) * arcRadius +
            down.y * Math.sin(step) * arcRadius,
        },
        pearlRadius,
        true
      );
    });
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

function circleAt(center, radius, accent = false, fill = null) {
  return {
    kind: "circle",
    x: center.x,
    y: center.y,
    radius,
    accent,
    ...(fill ? { fill } : {}),
  };
}

function offsetPoint(origin, axis, up, along, rise) {
  return {
    x: origin.x + axis.x * along + up.x * rise,
    y: origin.y + axis.y * along + up.y * rise,
  };
}

function eyeAt(center, rx, ry, angle, fill) {
  return { kind: "ellipse", x: center.x, y: center.y, rx, ry, angle, fill };
}
