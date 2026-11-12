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
    .map(([name, point]) => ({
      name,
      ...point,
      confidence: point.confidence ?? 0.95,
    }));

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

/**
 * Shapes in their documented order: chest, left arm, right arm, then the
 * joints (left shoulder, right shoulder, left elbow, right elbow) and head.
 */
function parts(shapes) {
  const rectangles = shapes.filter((shape) => shape.kind === "rectangle");
  const circles = shapes.filter((shape) => shape.kind === "circle");

  return {
    rectangles,
    circles,
    eyes: shapes.filter((shape) => shape.kind === "ellipse"),
    chest: rectangles[0],
    leftUpper: rectangles[1],
    leftForearm: rectangles[2],
    leftShoulder: circles[0],
    rightShoulder: circles[1],
    leftElbow: circles[2],
    rightElbow: circles[3],
    head: circles[circles.length - 1],
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
    const { girth, armLength, headSize, size } = FigureProportions.create(seed);
    return { girth, armLength, headSize, size };
  };

  assert.deepEqual(body(7), body(7));
  assert.notDeepEqual(body(7), body(8));
});

test("a neutral body follows the detected joints", () => {
  const {
    chest,
    leftUpper,
    leftForearm,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    head,
  } = parts(makeFigure().shapes(makePose()));

  approx(chest.x, 320, "chest x");
  approx(chest.y, 300, "chest y");
  approx(chest.length, 200, "chest length");
  approx(chest.thickness, 100, "chest thickness");
  approx(chest.radius, 100 * CONFIG.figure.cornerRatio, "chest radius");
  approx(chest.angle, Math.PI / 2, "chest angle");

  approx(leftUpper.x, 255, "upper arm x");
  approx(leftUpper.y, 240, "upper arm y");
  approx(leftUpper.length, Math.hypot(30, 80), "upper arm length");
  approx(leftUpper.thickness, 17, "upper arm thickness");
  approx(leftUpper.radius, 17 * CONFIG.figure.cornerRatio, "arm radius");

  approx(leftForearm.x, 230, "forearm x");
  approx(leftForearm.y, 315, "forearm y");
  approx(leftForearm.length, Math.hypot(20, 70), "forearm length");
  approx(leftForearm.thickness, 14, "forearm thickness");

  approx(leftShoulder.x, 270, "left shoulder x");
  approx(leftShoulder.radius, 13, "shoulder radius");
  approx(rightShoulder.x, 370, "right shoulder x");

  approx(leftElbow.x, 240, "left elbow x");
  approx(leftElbow.y, 280, "left elbow y");
  approx(leftElbow.radius, 13, "elbow radius");
  approx(rightElbow.x, 400, "right elbow x");

  approx(head.x, 320, "head x");
  approx(head.y, 115, "head y");
  approx(head.radius, 30, "head radius");
});

test("girth changes thickness without changing limb length or head size", () => {
  const thin = parts(makeFigure({ girth: 0.6 }).shapes(makePose()));
  const wide = parts(makeFigure({ girth: 1.8 }).shapes(makePose()));

  approx(thin.leftUpper.length, wide.leftUpper.length, "upper arm length");
  approx(thin.leftUpper.thickness, 17 * 0.6, "thin upper arm");
  approx(wide.leftUpper.thickness, 17 * 1.8, "wide upper arm");
  approx(thin.head.radius, wide.head.radius, "head radius");
  approx(thin.leftElbow.radius, 13 * 0.6, "thin elbow");
  approx(wide.leftElbow.radius, 13 * 1.8, "wide elbow");
});

test("arm length stretches both segments and keeps the chain connected", () => {
  const shapes = makeFigure({ armLength: 1.5 }).shapes(makePose());
  const { leftUpper: upper, leftForearm: forearm } = parts(shapes);

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

test("the elbow circle covers the bend of the figure", () => {
  const shapes = makeFigure({ armLength: 1.4 }).shapes(makePose());
  const { leftUpper, leftForearm, leftElbow } = parts(shapes);

  const upperEnd = endOf(leftUpper, 1);
  const forearmStart = endOf(leftForearm, -1);

  approx(leftElbow.x, upperEnd.x, "elbow x");
  approx(leftElbow.y, upperEnd.y, "elbow y");
  approx(upperEnd.x, forearmStart.x, "chain x");
  approx(upperEnd.y, forearmStart.y, "chain y");
  approx(leftElbow.radius, 13, "elbow radius");
});

test("head size varies independently of the arms", () => {
  const small = parts(makeFigure({ headSize: 0.16 }).shapes(makePose()));
  const big = parts(makeFigure({ headSize: 0.42 }).shapes(makePose()));

  approx(small.head.radius, 16, "small head");
  approx(big.head.radius, 42, "big head");
  approx(small.leftUpper.length, big.leftUpper.length, "arm length");
});

test("eyes sit on the tracked eye keypoints", () => {
  const shapes = makeFigure().shapes(makePose());
  const { eyes } = parts(shapes);

  assert.equal(eyes.length, 2);
  approx(eyes[0].x, 310, "left eye x");
  approx(eyes[0].y, 110, "left eye y");
  approx(eyes[1].x, 330, "right eye x");
  approx(eyes[0].rx, 20 * CONFIG.figure.ratios.eyeWidth, "eye rx");
  approx(eyes[0].ry, 20 * CONFIG.figure.ratios.eyeHeight, "eye ry");
  assert.ok(eyes[0].ry > eyes[0].rx, "eyes are vertically oval");
  approx(eyes[0].angle, 0, "eye angle");
  assert.equal(eyes[0].fill, "#000000");
  assert.equal(shapes.at(-1).kind, "ellipse", "eyes are drawn last");
});

test("eyes tilt with the tracked eye axis", () => {
  const { eyes } = parts(
    makeFigure().shapes(
      makePose({ left_eye: { x: 300, y: 100 }, right_eye: { x: 340, y: 120 } })
    )
  );

  approx(eyes[0].angle, Math.atan2(20, 40), "eye axis angle");
  approx(
    eyes[0].rx,
    Math.hypot(40, 20) * CONFIG.figure.ratios.eyeWidth,
    "eye rx"
  );
});

test("a single visible eye is still drawn", () => {
  const { eyes } = parts(makeFigure().shapes(makePose({ right_eye: null })));

  assert.equal(eyes.length, 1);
  approx(eyes[0].x, 310, "eye x");

  const headRadius = 100 * 0.3;
  approx(
    eyes[0].rx,
    headRadius *
      CONFIG.figure.ratios.eyeFallbackSeparation *
      CONFIG.figure.ratios.eyeWidth,
    "eye rx"
  );
  approx(eyes[0].angle, 0, "eye angle");
});

test("no tracked eyes means no ovals", () => {
  const shapes = makeFigure().shapes(
    makePose({ left_eye: null, right_eye: null })
  );

  assert.equal(shapes.filter((shape) => shape.kind === "ellipse").length, 0);
});

test("eyes scale with the body", () => {
  const { eyes } = parts(makeFigure({ size: 1.5 }).shapes(makePose()));

  approx(eyes[0].x, 320 + (310 - 320) * 1.5, "eye x");
  approx(eyes[0].y, 200 + (110 - 200) * 1.5, "eye y");
  approx(eyes[0].rx, 20 * CONFIG.figure.ratios.eyeWidth * 1.5, "eye rx");
  approx(eyes[0].ry, 20 * CONFIG.figure.ratios.eyeHeight * 1.5, "eye ry");
});

test("a one-frame blink still closes and reopens", () => {
  const figure = makeFigure();
  const open = parts(figure.shapes(makePose(), 0)).eyes;
  const openRy = open[0].ry;

  // One frame without eye keypoints is enough to close the lid.
  const blink = makePose({ left_eye: null, right_eye: null });
  figure.shapes(blink, 16);

  const closed = parts(figure.shapes(blink, 40)).eyes;
  assert.ok(closed[0].ry < openRy * 0.5, "the lid closes fast");
  approx(closed[0].x, open[0].x, "closed eye x");

  // The keypoints come back after 50 ms, but the minimum blink keeps it shut.
  const held = parts(figure.shapes(makePose(), 60)).eyes;
  assert.ok(held[0].ry < openRy * 0.5, "short blinks still read");

  let shapes;
  for (let t = 76; t <= 420; t += 16) shapes = figure.shapes(makePose(), t);
  assert.ok(parts(shapes).eyes[0].ry > openRy * 0.95, "the lid reopens");
});

test("a long closure stays closed while the keypoints are gone", () => {
  const figure = makeFigure();
  const openRy = parts(figure.shapes(makePose(), 0)).eyes[0].ry;

  const blink = makePose({ left_eye: null, right_eye: null });
  let shapes;
  for (let t = 16; t <= 400; t += 16) shapes = figure.shapes(blink, t);
  assert.ok(parts(shapes).eyes[0].ry < openRy * 0.2, "stays closed");

  for (let t = 416; t <= 700; t += 16) shapes = figure.shapes(makePose(), t);
  assert.ok(parts(shapes).eyes[0].ry > openRy * 0.9, "reopens");
});

test("eyes blink on their own every two seconds", () => {
  const figure = makeFigure();
  const openRy = parts(figure.shapes(makePose(), 0)).eyes[0].ry;

  assert.ok(parts(figure.shapes(makePose(), 1000)).eyes[0].ry > openRy * 0.95);

  // The autonomous beat at 2 s closes the lids during its hold.
  assert.ok(parts(figure.shapes(makePose(), 2050)).eyes[0].ry < openRy * 0.2);
  assert.ok(parts(figure.shapes(makePose(), 2400)).eyes[0].ry > openRy * 0.9);

  // The next beat repeats at 4 s.
  assert.ok(parts(figure.shapes(makePose(), 4050)).eyes[0].ry < openRy * 0.2);
});

test("a single lost eye does not blink the whole face", () => {
  const figure = makeFigure();
  const open = parts(figure.shapes(makePose(), 0)).eyes;
  const openRy = open[0].ry;

  let shapes;
  for (let t = 16; t <= 200; t += 16) {
    shapes = figure.shapes(makePose({ right_eye: null }), t);
  }

  const eyes = parts(shapes).eyes;
  assert.equal(eyes.length, 2, "the lost eye keeps its last position");
  const left = eyes.find((eye) => eye.x === 310);
  const right = eyes.find((eye) => eye.x === 330);
  assert.ok(left.ry > openRy * 0.9, "the visible eye stays open");
  assert.ok(right.ry < openRy * 0.5, "the lost eye closes");
});

test("a confidence drop squints the eyes", () => {
  const figure = makeFigure();
  const openRy = parts(figure.shapes(makePose(), 0)).eyes[0].ry;

  const squint = makePose({
    left_eye: { x: 310, y: 110, confidence: 0.4 },
    right_eye: { x: 330, y: 110, confidence: 0.4 },
  });

  let shapes;
  for (let t = 16; t <= 400; t += 16) shapes = figure.shapes(squint, t);

  const squinting = parts(shapes).eyes;
  assert.equal(squinting.length, 2, "a squint keeps both eyes");
  const ratio = squinting[0].ry / openRy;
  assert.ok(ratio < 0.75, "the eye narrows");
  assert.ok(ratio > 0.3, "the eye does not fully close");
});

test("eyes are forgotten after a long loss", () => {
  const figure = makeFigure();
  figure.shapes(makePose(), 0);

  const blink = makePose({ left_eye: null, right_eye: null });
  let shapes;
  for (let t = 16; t <= 900; t += 16) shapes = figure.shapes(blink, t);

  assert.equal(parts(shapes).eyes.length, 0);
});

test("rectangles have soft corners", () => {
  const figures = [
    makeFigure(),
    makeFigure({ girth: 1.9, armLength: 1.35, size: 1.5 }),
  ];

  for (const figure of figures) {
    const rectangles = figure
      .shapes(makePose())
      .filter((shape) => shape.kind === "rectangle");

    for (const shape of rectangles) {
      const halfShortSide = Math.min(shape.length, shape.thickness) / 2;
      assert.ok(shape.radius > 0, "corner radius should be positive");
      assert.ok(
        shape.radius <= halfShortSide,
        "corner radius should fit the short side"
      );
    }
  }
});

test("size scales the whole body around the chest", () => {
  const { chest, leftUpper, leftShoulder, leftElbow, head } = parts(
    makeFigure({ size: 1.5 }).shapes(makePose())
  );

  // The chest is the anchor, so the torso still starts on the shoulder line.
  approx(chest.x, 320, "chest x");
  approx(chest.y, 350, "chest y");
  approx(chest.length, 300, "chest length");
  approx(chest.thickness, 150, "chest thickness");
  approx(chest.radius, 150 * CONFIG.figure.cornerRatio, "chest radius");

  approx(leftUpper.x, 222.5, "upper arm x");
  approx(leftUpper.y, 260, "upper arm y");
  approx(leftUpper.length, Math.hypot(30, 80) * 1.5, "upper arm length");
  approx(leftUpper.thickness, 25.5, "upper arm thickness");
  approx(
    leftUpper.radius,
    17 * CONFIG.figure.cornerRatio * 1.5,
    "upper arm radius"
  );

  approx(leftShoulder.x, 245, "shoulder x");
  approx(leftShoulder.radius, 19.5, "shoulder radius");

  approx(leftElbow.x, 200, "elbow x");
  approx(leftElbow.y, 320, "elbow y");
  approx(leftElbow.radius, 19.5, "elbow radius");

  approx(head.x, 320, "head x");
  approx(head.y, 72.5, "head y");
  approx(head.radius, 45, "head radius");
});

test("small and large bodies differ in scale, not in shape", () => {
  const small = parts(makeFigure({ size: 0.6 }).shapes(makePose()));
  const big = parts(makeFigure({ size: 1.5 }).shapes(makePose()));

  approx(small.chest.x, big.chest.x, "chest x");
  approx(
    small.chest.thickness / big.chest.thickness,
    0.4,
    "thickness ratio"
  );
  approx(small.chest.length / big.chest.length, 0.4, "torso length ratio");
  approx(small.head.radius / big.head.radius, 0.4, "head ratio");
  assert.ok(small.head.y > big.head.y, "the small head sits closer to the chest");
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

  // Both shoulders and both elbows, no head.
  assert.equal(shapes.filter((shape) => shape.kind === "circle").length, 4);
});

test("an arm without an elbow is not drawn", () => {
  const shapes = makeFigure().shapes(makePose({ left_elbow: null }));

  assert.equal(shapes.filter((shape) => shape.kind === "rectangle").length, 3);
});

test("without hips the chest hangs below the shoulder line", () => {
  const { chest } = parts(
    makeFigure().shapes(makePose({ left_hip: null, right_hip: null }))
  );

  approx(chest.x, 320, "chest x");
  approx(chest.y, 245, "chest y");
  approx(chest.length, 90, "chest length");
  approx(chest.angle, Math.PI / 2, "chest angle");
});
