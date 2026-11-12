import test from "node:test";
import assert from "node:assert/strict";

import { Pose } from "../pose.js";
import { FigureProportions, GeometricFigure } from "../figure.js";

/**
 * Rendering smoke test. p5 needs a DOM, so the painter is stubbed: this pins
 * the label contract and the figure/skeleton switch without a browser.
 */

let painter = null;

function createPainter() {
  return {
    width: 800,
    height: 600,
    LEFT: "left",
    RIGHT: "right",
    BOTTOM: "bottom",
    CENTER: "center",
    labels: [],
    circles: [],
    rectangles: [],
    rotations: [],
    background() {},
    createCanvas() {},
    resizeCanvas() {},
    color(hex) {
      return { hex, setAlpha() {} };
    },
    stroke() {},
    strokeWeight() {},
    noFill() {},
    noStroke() {},
    fill() {},
    circle(x, y, diameter) {
      this.circles.push({ x, y, diameter });
    },
    line() {},
    push() {},
    pop() {},
    translate() {},
    rotate(angle) {
      this.rotations.push(angle);
    },
    rectMode() {},
    rect(x, y, width, height) {
      this.rectangles.push({ x, y, width, height });
    },
    textFont() {},
    textSize() {},
    textAlign() {},
    text(value, x, y) {
      this.labels.push({ value, x, y });
    },
    textWidth(value) {
      return value.length * 6;
    },
  };
}

globalThis.p5 = class {
  constructor(sketch) {
    painter = createPainter();
    sketch(painter);
    painter.setup?.();
  }
};

const { SkeletonView } = await import("../skeleton-view.js");
const { CONFIG } = await import("../config.js");

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

function makeFigure(overrides = {}) {
  return new GeometricFigure(
    new FigureProportions({
      seed: 1,
      girth: 1,
      armLength: 1,
      headSize: 0.3,
      ...overrides,
    })
  );
}

/** Applies config changes for one test and restores them afterwards. */
function withConfig(changes, run) {
  const saved = changes.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, value] of changes) target[key] = value;

  try {
    return run();
  } finally {
    for (const [target, key, value] of saved) target[key] = value;
  }
}

function render(pose, { figure = null } = {}) {
  const view = new SkeletonView({});
  view.setVideoSize(640, 480);
  view.setConnections([[5, 7], [7, 9], [6, 8], [8, 10]]);
  view.setParticipants([{ slotId: 0, state: "LOCKED", pose, figure }]);
  view.render(painter);
  return view;
}

function renderSkeleton(pose) {
  return withConfig([[CONFIG.figure, "enabled", false]], () => render(pose));
}

function labelValues() {
  return painter.labels.map((label) => label.value);
}

test("skeleton mode labels every visible articulation with its rig name", () => {
  renderSkeleton(makePose());

  for (const name of [
    "shoulder.L",
    "shoulder.R",
    "elbow.L",
    "elbow.R",
    "wrist.L",
    "wrist.R",
    "hip.L",
    "hip.R",
    "chest",
    "pelvis",
    "head",
  ]) {
    assert.ok(labelValues().includes(name), `missing label ${name}`);
  }
});

test("skeleton mode does not label head markers", () => {
  renderSkeleton(makePose());

  for (const name of ["nose", "eye.L", "eye.R", "ear.L", "ear.R"]) {
    assert.ok(!labelValues().includes(name), `marker labelled: ${name}`);
  }
});

test("head label follows the ears, then the eyes, then the nose", () => {
  const offset = CONFIG.skeleton.jointLabelOffset;
  const hideFace = { left_ear: null, right_ear: null };
  const hideEyesToo = { ...hideFace, left_eye: null, right_eye: null };

  const cases = [
    { name: "ears", hide: {}, point: { x: 320, y: 115 } },
    { name: "eyes", hide: hideFace, point: { x: 320, y: 110 } },
    { name: "nose", hide: hideEyesToo, point: { x: 320, y: 120 } },
  ];

  for (const { name, hide, point } of cases) {
    const view = renderSkeleton(makePose(hide));
    const expected = view.project(point, view.transform(painter));
    const head = painter.labels.filter((label) => label.value === "head");

    assert.equal(head.length, 1, `head label count with ${name}`);
    assert.equal(head[0].x, expected.x + offset, `head x from ${name}`);
    assert.equal(head[0].y, expected.y - offset, `head y from ${name}`);
  }
});

test("showJointNames turns the labels off", () => {
  withConfig(
    [
      [CONFIG.figure, "enabled", false],
      [CONFIG.skeleton, "showJointNames", false],
    ],
    () => {
      render(makePose());
      assert.deepEqual(labelValues(), []);
    }
  );
});

test("figure mode replaces the skeleton with the geometric body", () => {
  render(makePose(), { figure: makeFigure() });

  // Chest plus four arm segments.
  assert.equal(painter.rectangles.length, 5);
  // Two shoulders plus the head.
  assert.equal(painter.circles.length, 3);
  assert.deepEqual(labelValues(), []);
});

test("showSkeleton draws the debug skeleton under the figure", () => {
  withConfig([[CONFIG.figure, "showSkeleton", true]], () => {
    render(makePose(), { figure: makeFigure() });
  });

  assert.equal(painter.rectangles.length, 5);
  assert.ok(labelValues().includes("shoulder.L"));
});

test("mirroring reverses the rectangle rotation, and only then", () => {
  const rectangles = makeFigure()
    .shapes(makePose())
    .filter((shape) => shape.kind === "rectangle");

  render(makePose(), { figure: makeFigure() });
  rectangles.forEach((shape, index) => {
    approx(painter.rotations[index], -shape.angle, "mirrored angle");
  });

  withConfig([[CONFIG.skeleton, "mirror", false]], () => {
    render(makePose(), { figure: makeFigure() });
  });
  rectangles.forEach((shape, index) => {
    approx(painter.rotations[index], shape.angle, "plain angle");
  });
});

function approx(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, got ${actual}`
  );
}
