import test from "node:test";
import assert from "node:assert/strict";

import { CONFIG } from "../config.js";
import { FigureProportions, GeometricFigure, SeededRandom } from "../figure.js";
import { Pose } from "../pose.js";

const UPPER_BODY = {
  nose: { x: 320, y: 120 },
  left_eye: { x: 310, y: 110 },
  right_eye: { x: 330, y: 110 },
  left_ear: { x: 295, y: 115 },
  right_ear: { x: 345, y: 115 },
  left_shoulder: { x: 270, y: 200 },
  right_shoulder: { x: 370, y: 200 },
  left_elbow: { x: 240, y: 280 },
  right_elbow: { x: 400, y: 280 },
  left_wrist: { x: 220, y: 350 },
  right_wrist: { x: 420, y: 350 },
  left_hip: { x: 290, y: 400 },
  right_hip: { x: 350, y: 400 },
};

function makePose(overrides = {}) {
  const points = { ...UPPER_BODY, ...overrides };
  const keypoints = Object.entries(points)
    .filter(([, point]) => point !== null)
    .map(([name, point]) => ({ name, ...point, confidence: 0.95 }));

  const raw = { keypoints };
  for (const point of keypoints) raw[point.name] = point;

  return new Pose(raw);
}

/** Neutral body: every multiplier is 1, so shapes equal the detected joints. */
function makeFigure(overrides = {}) {
  return new GeometricFigure(
    new FigureProportions({
      seed: 1,
      girth: 1,
      armLength: 1,
      headSize: 0.3,
      size: 1,
      ...overrides,
    })
  );
}

function approx(actual, expected, label = "") {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${label} expected ${expected}, got ${actual}`
  );
}

/** One end of a rectangle in video coordinates; sign -1 is the start. */
function endOf(rectangle, sign) {
  return {
    x: rectangle.x + sign * (Math.cos(rectangle.angle) * rectangle.length) / 2,
    y: rectangle.y + sign * (Math.sin(rectangle.angle) * rectangle.length) / 2,
  };
}

test("the seeded random is deterministic", () => {
  const a = new SeededRandom(42);
  const b = new SeededRandom(42);

  for (let i = 0; i < 5; i += 1) {
    assert.equal(a.next(), b.next());
  }
});

test("proportions stay inside the configured ranges", () => {
  const ranges = CONFIG.figure.proportions;

  for (let seed = 1; seed <= 200; seed += 1) {
    const proportions = FigureProportions.create(seed);

    for (const [name, value] of [
      ["girth", proportions.girth],
      ["armLength", proportions.armLength],
      ["headSize", proportions.headSize],
      ["size", proportions.size],
    ]) {
      assert.ok(
        value >= ranges[name][0] && value <= ranges[name][1],
        `${name} out of range: ${value}`
      );
    }
  }
});

test("one seed is one body, and different seeds are different bodies", () => {
  const body = (seed) => {
    const { girth, armLength, headSize } = FigureProportions.create(seed);
    return { girth, armLength, headSize };
  };

  assert.deepEqual(body(7), body(7));
  assert.notDeepEqual(body(7), body(8));
});

test("a neutral body follows the detected joints", () => {
  const [chest, leftUpper, leftForearm, , , leftShoulder, rightShoulder, head] =
    makeFigure().shapes(makePose());

  approx(chest.x, 320, "chest x");
  approx(chest.y, 300, "chest y");
  approx(chest.length, 200, "chest length");
  approx(chest.thickness, 100, "chest thickness");
  approx(chest.angle, Math.PI / 2, "chest angle");

  approx(leftUpper.x, 255, "upper arm x");
  approx(leftUpper.y, 240, "upper arm y");
  approx(leftUpper.length, Math.hypot(30, 80), "upper arm length");
  approx(leftUpper.thickness, 17, "upper arm thickness");

  approx(leftForearm.x, 230, "forearm x");
  approx(leftForearm.y, 315, "forearm y");
  approx(leftForearm.length, Math.hypot(20, 70), "forearm length");
  approx(leftForearm.thickness, 14, "forearm thickness");

  approx(leftShoulder.x, 270, "left shoulder x");
  approx(leftShoulder.radius, 13, "shoulder radius");
  approx(rightShoulder.x, 370, "right shoulder x");

  approx(head.x, 320, "head x");
  approx(head.y, 115, "head y");
  approx(head.radius, 30, "head radius");
});

test("girth changes thickness without changing limb length or head size", () => {
  const thin = makeFigure({ girth: 0.6 }).shapes(makePose());
  const wide = makeFigure({ girth: 1.8 }).shapes(makePose());

  approx(thin[1].length, wide[1].length, "upper arm length");
  approx(thin[1].thickness, 17 * 0.6, "thin upper arm");
  approx(wide[1].thickness, 17 * 1.8, "wide upper arm");
  approx(thin[7].radius, wide[7].radius, "head radius");
});

test("arm length stretches both segments and keeps the chain connected", () => {
  const shapes = makeFigure({ armLength: 1.5 }).shapes(makePose());
  const upper = shapes[1];
  const forearm = shapes[2];

  approx(upper.length, Math.hypot(30, 80) * 1.5, "upper length");
  approx(forearm.length, Math.hypot(20, 70) * 1.5, "forearm length");

  const shoulderEnd = endOf(upper, -1);
  approx(shoulderEnd.x, 270, "arm anchored at shoulder x");
  approx(shoulderEnd.y, 200, "arm anchored at shoulder y");

  const upperEnd = endOf(upper, 1);
  const forearmStart = endOf(forearm, -1);
  approx(upperEnd.x, forearmStart.x, "elbow x");
  approx(upperEnd.y, forearmStart.y, "elbow y");
});

test("head size varies independently of the arms", () => {
  const small = makeFigure({ headSize: 0.16 }).shapes(makePose());
  const big = makeFigure({ headSize: 0.42 }).shapes(makePose());

  approx(small[7].radius, 16, "small head");
  approx(big[7].radius, 42, "big head");
  approx(small[1].length, big[1].length, "arm length");
});

test("size scales the whole body around the chest", () => {
  const [chest, leftUpper, , , , leftShoulder, , head] = makeFigure({
    size: 1.5,
  }).shapes(makePose());

  // The chest is the anchor, so the torso still starts on the shoulder line.
  approx(chest.x, 320, "chest x");
  approx(chest.y, 350, "chest y");
  approx(chest.length, 300, "chest length");
  approx(chest.thickness, 150, "chest thickness");

  approx(leftUpper.x, 222.5, "upper arm x");
  approx(leftUpper.y, 260, "upper arm y");
  approx(leftUpper.length, Math.hypot(30, 80) * 1.5, "upper arm length");
  approx(leftUpper.thickness, 25.5, "upper arm thickness");

  approx(leftShoulder.x, 245, "shoulder x");
  approx(leftShoulder.radius, 19.5, "shoulder radius");

  approx(head.x, 320, "head x");
  approx(head.y, 72.5, "head y");
  approx(head.radius, 45, "head radius");
});

test("small and large bodies differ in scale, not in shape", () => {
  const small = makeFigure({ size: 0.6 }).shapes(makePose());
  const big = makeFigure({ size: 1.5 }).shapes(makePose());

  approx(small[0].x, big[0].x, "chest x");
  approx(small[0].thickness / big[0].thickness, 0.4, "thickness ratio");
  approx(small[0].length / big[0].length, 0.4, "torso length ratio");
  approx(small[7].radius / big[7].radius, 0.4, "head ratio");
  assert.ok(small[7].y > big[7].y, "the small head sits closer to the chest");
});

test("no head reference means no head circle", () => {
  const shapes = makeFigure().shapes(
    makePose({
      nose: null,
      left_eye: null,
      right_eye: null,
      left_ear: null,
      right_ear: null,
    })
  );

  assert.equal(shapes.filter((shape) => shape.kind === "circle").length, 2);
});

test("an arm without an elbow is not drawn", () => {
  const shapes = makeFigure().shapes(makePose({ left_elbow: null }));

  assert.equal(shapes.filter((shape) => shape.kind === "rectangle").length, 3);
});

test("without hips the chest hangs below the shoulder line", () => {
  const chest = makeFigure().shapes(
    makePose({ left_hip: null, right_hip: null })
  )[0];

  approx(chest.x, 320, "chest x");
  approx(chest.y, 245, "chest y");
  approx(chest.length, 90, "chest length");
  approx(chest.angle, Math.PI / 2, "chest angle");
});
