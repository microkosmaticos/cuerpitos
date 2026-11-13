import test from "node:test";
import assert from "node:assert/strict";

import { CONFIG } from "../config.js";
import {
  FigureProportions,
  GeometricFigure,
} from "../figure.js";
import { fistTouchesBody } from "../reactions.js";
import { Pose } from "../pose.js";

function makePose(points) {
  const keypoints = Object.entries(points)
    .filter(([, point]) => point !== null)
    .map(([name, point]) => ({ name, ...point, confidence: 0.95 }));

  const raw = { keypoints };
  for (const point of keypoints) raw[point.name] = point;

  return new Pose(raw);
}

const SELF = {
  left_shoulder: { x: 270, y: 200 },
  right_shoulder: { x: 370, y: 200 },
  left_elbow: { x: 240, y: 280 },
  right_elbow: { x: 400, y: 280 },
  left_wrist: { x: 220, y: 350 },
  right_wrist: { x: 420, y: 350 },
};

const COMPANION_RIGHT = {
  left_shoulder: { x: 470, y: 200 },
  right_shoulder: { x: 570, y: 200 },
};

const COMPANION_LEFT = {
  left_shoulder: { x: 70, y: 200 },
  right_shoulder: { x: 170, y: 200 },
};

/** A reachable victim with a head, so the dizzy stars have an anchor. */
const TARGET = {
  ...COMPANION_RIGHT,
  left_ear: { x: 485, y: 115 },
  right_ear: { x: 555, y: 115 },
  left_eye: { x: 500, y: 110 },
  right_eye: { x: 540, y: 110 },
};

/** A victim far out of the attacker's reach. */
const FAR_TARGET = {
  ...TARGET,
  left_shoulder: { x: 870, y: 200 },
  right_shoulder: { x: 970, y: 200 },
  left_ear: { x: 885, y: 115 },
  right_ear: { x: 955, y: 115 },
  left_eye: { x: 900, y: 110 },
  right_eye: { x: 940, y: 110 },
};

function makeFigure({ random = () => 0 } = {}) {
  const proportions = new FigureProportions({
    seed: 1,
    girth: 1,
    armLength: 1,
    headSize: 0.3,
    size: 1,
    accessory: null,
  });

  return new GeometricFigure(proportions, { random });
}

function punchShapes(shapes) {
  return shapes.filter((shape) => shape.reaction === "punch");
}

function punchHand(shapes) {
  // The elbow circle comes first and the fist last.
  return punchShapes(shapes)
    .filter((shape) => shape.kind === "circle")
    .pop();
}

function torsoX(shapes) {
  return shapes.find((shape) => shape.kind === "rectangle").x;
}

function approx(actual, expected, label = "", tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${label} expected ${expected}, got ${actual}`
  );
}

const duration = CONFIG.figure.reactions.punch.durationMs;

test("a punch extends the arm towards the companion", () => {
  const self = makePose(SELF);
  const companion = makePose(COMPANION_RIGHT);
  const figure = makeFigure();

  // The reaction starts on the first frame and is fully extended at 70%.
  figure.shapes(self, 0, companion);
  const shapes = figure.shapes(self, duration * 0.7, companion);
  const hand = punchHand(shapes);

  assert.ok(hand, "the punch draws a fist");
  approx(hand.y, 200, "the punch aims horizontally");
  assert.ok(hand.x > 500, "the fist reaches the companion's side");
});

test("the punch follows the tracked arm length", () => {
  const self = makePose(SELF);
  const companion = makePose(COMPANION_RIGHT);
  const figure = makeFigure();

  // Right shoulder -> elbow -> wrist, stretched by armLength = 1.
  const reach = Math.hypot(30, 80) + Math.hypot(20, 70);

  figure.shapes(self, 0, companion);
  const hand = punchHand(figure.shapes(self, duration * 0.7, companion));

  approx(hand.x, 370 + reach, "fist x", 1);
});

test("the punch uses the arm on the companion's side", () => {
  const self = makePose(SELF);
  const companion = makePose(COMPANION_LEFT);
  const figure = makeFigure();

  figure.shapes(self, 0, companion);
  const shapes = figure.shapes(self, duration * 0.7, companion);
  const hand = punchHand(shapes);

  assert.ok(hand, "the punch draws a fist");
  assert.ok(hand.x < 270, "the fist reaches the companion on the left");

  // The other arm keeps following the tracked pose.
  const otherHand = shapes.find(
    (shape) =>
      shape.kind === "circle" &&
      !shape.reaction &&
      Math.abs(shape.x - 420) < 1e-6 &&
      Math.abs(shape.y - 350) < 1e-6
  );
  assert.ok(otherHand, "the free arm keeps its tracked hand");
});

test("the punch picks the shoulder by position when labels are mirrored", () => {
  const swapped = makePose({
    left_shoulder: { x: 370, y: 200 },
    right_shoulder: { x: 270, y: 200 },
    left_elbow: { x: 400, y: 280 },
    right_elbow: { x: 240, y: 280 },
    left_wrist: { x: 420, y: 350 },
    right_wrist: { x: 220, y: 350 },
  });
  const companion = makePose(COMPANION_RIGHT);
  const figure = makeFigure();

  figure.shapes(swapped, 0, companion);
  const hand = punchHand(figure.shapes(swapped, duration * 0.7, companion));

  assert.ok(hand, "the punch draws a fist");
  assert.ok(hand.x > 500, "it punches from the rightmost shoulder");
});

test("the arm grows during the strike and retracts afterwards", () => {
  const self = makePose(SELF);
  const companion = makePose(COMPANION_RIGHT);
  const figure = makeFigure();
  const shoulder = { x: 370, y: 200 };

  figure.shapes(self, 0, companion);
  const early = punchHand(figure.shapes(self, duration * 0.15, companion));
  const late = punchHand(figure.shapes(self, duration * 0.7, companion));

  assert.ok(early, "the arm is already out during the strike");
  assert.ok(late, "the arm is extended at full reach");
  assert.ok(
    Math.hypot(early.x - shoulder.x, early.y - shoulder.y) <
      Math.hypot(late.x - shoulder.x, late.y - shoulder.y),
    "the arm extends towards the companion"
  );
});

test("a figure alone never reacts", () => {
  const self = makePose(SELF);
  const figure = makeFigure();

  for (let now = 0; now <= 40000; now += 250) {
    assert.equal(
      punchShapes(figure.shapes(self, now, null)).length,
      0,
      "no companion means no punch"
    );
  }
});

test("a reaction plays once every interval", () => {
  const self = makePose(SELF);
  const companion = makePose(COMPANION_RIGHT);
  // Random phase 0.5: the first reaction lands 5 s after the figure starts.
  const figure = makeFigure({ random: () => 0.5 });

  figure.shapes(self, 1000, companion);
  assert.equal(punchShapes(figure.shapes(self, 5999, companion)).length, 0);

  figure.shapes(self, 6000, companion);
  assert.ok(
    punchShapes(figure.shapes(self, 6630, companion)).length > 0,
    "the reaction plays when its window opens"
  );

  assert.equal(
    punchShapes(figure.shapes(self, 6900, companion)).length,
    0,
    "the reaction ends after its duration"
  );

  assert.equal(punchShapes(figure.shapes(self, 15999, companion)).length, 0);
  figure.shapes(self, 16000, companion);
  assert.ok(
    punchShapes(figure.shapes(self, 16630, companion)).length > 0,
    "the next window plays another reaction"
  );
});

test("the punch falls back to proportional arm lengths when keypoints hide", () => {
  const self = makePose({
    ...SELF,
    right_elbow: null,
    right_wrist: null,
  });
  const companion = makePose(COMPANION_RIGHT);
  const figure = makeFigure();

  figure.shapes(self, 0, companion);
  const hand = punchHand(figure.shapes(self, duration * 0.7, companion));
  const reach =
    100 * CONFIG.figure.reactions.punch.upperFallback +
    100 * CONFIG.figure.reactions.punch.forearmFallback;

  assert.ok(hand, "the punch still draws a fist");
  approx(hand.x, 370 + reach, "fist x", 1);
});

test("the fist only hits inside the torso hitbox", () => {
  const victim = makePose(TARGET);

  assert.equal(fistTouchesBody({ x: 520, y: 200, radius: 15 }, victim), true);
  assert.equal(fistTouchesBody({ x: 580, y: 200, radius: 15 }, victim), false);
});

test("a landed punch knocks the victim back and draws dizzy stars", () => {
  const attackerPose = makePose(SELF);
  const victimPose = makePose(TARGET);
  const attacker = makeFigure();
  const victim = makeFigure({ random: () => 0.5 });

  // Frame 0: the attacker starts the punch, the victim is untouched.
  attacker.shapes(attackerPose, 0, { pose: victimPose, figure: victim });
  const clean = victim.shapes(victimPose, 0, {
    pose: attackerPose,
    figure: attacker,
  });
  assert.equal(clean.filter((shape) => shape.kind === "star").length, 0);
  approx(torsoX(clean), 520, "chest x before the hit");

  // The fist reaches the chest and the victim reacts in the same frame.
  const hit = victim.shapes(victimPose, 300, {
    pose: attackerPose,
    figure: attacker,
  });
  assert.equal(
    hit.filter((shape) => shape.kind === "star").length,
    CONFIG.figure.impact.stars.count
  );

  // Mid-knockback the body is pushed away from the fist.
  const pushed = victim.shapes(victimPose, 625, {
    pose: attackerPose,
    figure: attacker,
  });
  assert.ok(torsoX(pushed) > 528, "the chest moves away from the punch");

  const eyes = pushed.filter(
    (shape) => shape.fill === CONFIG.figure.eyeColor
  );
  assert.equal(eyes.length, 2);
  for (const eye of eyes) {
    assert.ok(Math.abs(eye.angle) > 0.1, "the eyes roll while dizzy");
  }

  // After the reaction the figure is back on the tracked pose.
  const recovered = victim.shapes(victimPose, 2100, {
    pose: attackerPose,
    figure: attacker,
  });
  assert.equal(
    recovered.filter((shape) => shape.kind === "star").length,
    0,
    "the stars disappear"
  );
  approx(torsoX(recovered), 520, "the chest returns to the pose");
});

test("a punch out of reach does not hit", () => {
  const attackerPose = makePose(SELF);
  const victimPose = makePose(FAR_TARGET);
  const attacker = makeFigure();
  const victim = makeFigure({ random: () => 0.5 });

  attacker.shapes(attackerPose, 0, { pose: victimPose, figure: victim });
  const shapes = victim.shapes(victimPose, 400, {
    pose: attackerPose,
    figure: attacker,
  });

  assert.equal(shapes.filter((shape) => shape.kind === "star").length, 0);
  approx(torsoX(shapes), 920, "the far victim does not move");
});

test("a figure with no punch exposes no fist", () => {
  const figure = makeFigure({ random: () => 0.5 });

  assert.equal(figure.punchFist(0), null);
});
