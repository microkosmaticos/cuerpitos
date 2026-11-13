import test from "node:test";
import assert from "node:assert/strict";

import { CONFIG } from "../config.js";
import { FigureProportions, GeometricFigure } from "../figure.js";
import {
  ReactionDirector,
  REACTION_LIBRARY,
  fistTouchesBody,
} from "../reactions/index.js";
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

function makeFigure(proportions = {}) {
  return new GeometricFigure(
    new FigureProportions({
      seed: 1,
      girth: 1,
      armLength: 1,
      headSize: 0.3,
      size: 1,
      accessory: null,
      ...proportions,
    })
  );
}

function participant(pose, figure, state = "ACTIVE", slotId = 0) {
  return { slotId, participantId: `p${slotId + 1}`, pose, figure, state };
}

/** A random source that returns fixed values in order, then the last one. */
function sequenceRandom(...values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

/** A director that only knows one reaction, so the pick is deterministic. */
function startReaction(id, participants, now = 0) {
  const definition = REACTION_LIBRARY.find((reaction) => reaction.id === id);
  const director = new ReactionDirector({
    random: sequenceRandom(0, 0, 0, 0),
    library: [definition],
  });

  director.update(now, participants);
  return director;
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

function twoParticipants() {
  return [
    participant(makePose(SELF), makeFigure(), "ACTIVE", 0),
    participant(makePose(TARGET), makeFigure(), "ACTIVE", 1),
  ];
}

test("the reaction library exposes one module per reaction", () => {
  assert.deepEqual(
    REACTION_LIBRARY.map((reaction) => reaction.id),
    ["punch", "heart"]
  );
});

test("the director plays one reaction every interval", () => {
  const director = new ReactionDirector({
    random: sequenceRandom(0, 0, 0, 0, 0),
  });
  const participants = twoParticipants();

  const first = director.update(0, participants);
  assert.ok(first, "a reaction starts");
  assert.equal(first.id, "punch");

  assert.ok(director.update(500, participants), "it stays active");
  assert.equal(director.update(900, participants), null, "it ends");
  assert.equal(director.update(9999, participants), null, "nothing in between");
  assert.ok(director.update(10000, participants), "the next window plays");
});

test("there is never more than one reaction at a time", () => {
  const director = new ReactionDirector({
    random: sequenceRandom(0, 0, 0, 0),
  });
  const participants = twoParticipants();

  director.update(0, participants);

  assert.equal(director.active.id, "punch");
  assert.deepEqual(director.props(0).shapes, [], "no heart while punching");
  assert.ok(director.reactionFor(participants[0]), "the attacker owns the punch");
  assert.equal(director.reactionFor(participants[1]), null);

  // A second update inside the window cannot start another reaction.
  director.update(500, participants);
  assert.equal(director.active.id, "punch");
});

test("the punch stays on the attacker when participants are rebuilt", () => {
  const attackerFigure = makeFigure();
  const victimFigure = makeFigure();
  const first = [
    participant(makePose(SELF), attackerFigure, "ACTIVE", 0),
    participant(makePose(TARGET), victimFigure, "ACTIVE", 1),
  ];
  const director = startReaction("punch", first);

  // The tracker rebuilds participant objects every frame; the slot is stable.
  const rebuilt = [
    participant(makePose(SELF), attackerFigure, "ACTIVE", 0),
    participant(makePose(TARGET), victimFigure, "ACTIVE", 1),
  ];

  assert.equal(director.reactionFor(rebuilt[0])?.id, "punch");
  assert.equal(director.reactionFor(rebuilt[1]), null);
});

test("a figure alone never gets a reaction", () => {
  const director = new ReactionDirector({ random: () => 0 });
  const only = [participant(makePose(SELF), makeFigure())];

  assert.equal(director.update(0, only), null);
  assert.deepEqual(director.props(0).shapes, []);
});

test("the punch lends its arm to the attacker", () => {
  const participants = twoParticipants();
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(participants[0]);
  const shapes = participants[0].figure.shapes(
    participants[0].pose,
    CONFIG.figure.reactions.punch.durationMs * 0.7,
    participants[1],
    reaction
  );
  const hand = punchHand(shapes);

  assert.ok(hand, "the punch draws a fist");
  assert.ok(hand.x > 500, "the fist reaches the companion's side");
});

test("the punch uses the arm on the companion's side", () => {
  const participants = [
    participant(makePose(SELF), makeFigure(), "ACTIVE", 0),
    participant(makePose(COMPANION_LEFT), makeFigure(), "ACTIVE", 1),
  ];
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(participants[0]);
  const shapes = participants[0].figure.shapes(
    participants[0].pose,
    CONFIG.figure.reactions.punch.durationMs * 0.7,
    participants[1],
    reaction
  );

  const hand = punchHand(shapes);
  assert.ok(hand, "the punch draws a fist");
  assert.ok(hand.x < 270, "the fist reaches the companion on the left");

  const freeHand = shapes.find(
    (shape) =>
      shape.kind === "circle" &&
      !shape.reaction &&
      Math.abs(shape.x - 420) < 1e-6 &&
      Math.abs(shape.y - 350) < 1e-6
  );
  assert.ok(freeHand, "the free arm keeps its tracked hand");
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
  const participants = [
    participant(swapped, makeFigure(), "ACTIVE", 0),
    participant(makePose(TARGET), makeFigure(), "ACTIVE", 1),
  ];
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(participants[0]);
  const hand = punchHand(
    participants[0].figure.shapes(
      participants[0].pose,
      CONFIG.figure.reactions.punch.durationMs * 0.7,
      participants[1],
      reaction
    )
  );

  assert.ok(hand, "the punch draws a fist");
  assert.ok(hand.x > 500, "it punches from the rightmost shoulder");
});

test("the arm grows during the strike and retracts afterwards", () => {
  const participants = twoParticipants();
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(participants[0]);
  const [attacker, victim] = participants;
  const duration = CONFIG.figure.reactions.punch.durationMs;
  const shoulder = { x: 370, y: 200 };

  const early = punchHand(
    attacker.figure.shapes(attacker.pose, duration * 0.15, victim, reaction)
  );
  const late = punchHand(
    attacker.figure.shapes(attacker.pose, duration * 0.7, victim, reaction)
  );

  assert.ok(early, "the arm is already out during the strike");
  assert.ok(late, "the arm is extended at full reach");
  assert.ok(
    Math.hypot(early.x - shoulder.x, early.y - shoulder.y) <
      Math.hypot(late.x - shoulder.x, late.y - shoulder.y),
    "the arm extends towards the companion"
  );
});

test("the punch falls back to proportional arm lengths when keypoints hide", () => {
  const self = makePose({
    ...SELF,
    right_elbow: null,
    right_wrist: null,
  });
  const participants = [
    participant(self, makeFigure(), "ACTIVE", 0),
    participant(makePose(COMPANION_RIGHT), makeFigure(), "ACTIVE", 1),
  ];
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(participants[0]);
  const hand = punchHand(
    participants[0].figure.shapes(
      participants[0].pose,
      CONFIG.figure.reactions.punch.durationMs * 0.7,
      participants[1],
      reaction
    )
  );
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
  const participants = [
    participant(makePose(SELF), makeFigure(), "ACTIVE", 0),
    participant(makePose(TARGET), makeFigure(), "ACTIVE", 1),
  ];
  const [attacker, victim] = participants;
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(attacker);

  // Frame 0: the attacker starts the punch, the victim is untouched.
  attacker.figure.shapes(attacker.pose, 0, victim, reaction);
  const clean = victim.figure.shapes(victim.pose, 0, attacker, null);
  assert.equal(clean.filter((shape) => shape.kind === "star").length, 0);
  approx(torsoX(clean), 520, "chest x before the hit");

  // The fist reaches the chest and the victim reacts in the same frame.
  const hit = victim.figure.shapes(victim.pose, 300, attacker, null);
  assert.equal(
    hit.filter((shape) => shape.kind === "star").length,
    CONFIG.figure.impact.stars.count
  );

  // Mid-knockback the body is pushed away from the fist.
  const pushed = victim.figure.shapes(victim.pose, 625, attacker, null);
  assert.ok(torsoX(pushed) > 528, "the chest moves away from the punch");

  const eyes = pushed.filter(
    (shape) => shape.fill === CONFIG.figure.eyeColor
  );
  assert.equal(eyes.length, 2);
  for (const eye of eyes) {
    assert.ok(Math.abs(eye.angle) > 0.1, "the eyes roll while dizzy");
  }

  // After the reaction the figure is back on the tracked pose.
  const recovered = victim.figure.shapes(victim.pose, 2100, attacker, null);
  assert.equal(
    recovered.filter((shape) => shape.kind === "star").length,
    0,
    "the stars disappear"
  );
  approx(torsoX(recovered), 520, "the chest returns to the pose");
});

test("a punch out of reach does not hit", () => {
  const participants = [
    participant(makePose(SELF), makeFigure(), "ACTIVE", 0),
    participant(makePose(FAR_TARGET), makeFigure(), "ACTIVE", 1),
  ];
  const [attacker, victim] = participants;
  const director = startReaction("punch", participants);
  const reaction = director.reactionFor(attacker);

  attacker.figure.shapes(attacker.pose, 0, victim, reaction);
  const shapes = victim.figure.shapes(victim.pose, 400, attacker, null);

  assert.equal(shapes.filter((shape) => shape.kind === "star").length, 0);
  approx(torsoX(shapes), 920, "the far victim does not move");
});

test("a figure with no punch exposes no fist", () => {
  const figure = makeFigure();

  assert.equal(figure.punchFist(0), null);
});

test("a heart appears between both figures", () => {
  const participants = twoParticipants();
  const director = startReaction("heart", participants);

  assert.equal(director.active.id, "heart");
  assert.equal(director.reactionFor(participants[0]), null);
  assert.equal(director.reactionFor(participants[1]), null);

  const duration = CONFIG.figure.reactions.heart.durationMs;
  const props = director.props(duration * 0.5);
  const heart = props.shapes.find(
    (shape) => shape.kind === "heart" && shape.main
  );

  assert.ok(heart, "the heart appears");
  approx(heart.x, 420, "the heart is centred between both chests");
  approx(heart.y, 160, "the heart floats up", 1e-4);
  assert.ok(heart.size > 0, "the heart has a size");
  assert.ok(props.colors, "the drawer palette is used");
});

test("the heart disappears after its reaction", () => {
  const participants = twoParticipants();
  const director = startReaction("heart", participants);
  const duration = CONFIG.figure.reactions.heart.durationMs;

  director.update(duration, participants);

  assert.equal(
    director.props(duration).shapes.filter(
      (shape) => shape.kind === "heart"
    ).length,
    0,
    "the heart is gone"
  );
});

test("the flying heart leaves a trail of smaller hearts", () => {
  const participants = twoParticipants();
  const director = startReaction("heart", participants);
  const duration = CONFIG.figure.reactions.heart.durationMs;
  const hearts = director
    .props(duration * 0.8)
    .shapes.filter((shape) => shape.kind === "heart");
  const main = hearts.find((shape) => shape.main);
  const trail = hearts.filter((shape) => !shape.main);

  assert.ok(main, "the main heart is flying");
  assert.ok(trail.length > 0, "trail hearts appear behind it");
  for (const heart of trail) {
    assert.ok(heart.size < main.size, "trail hearts are smaller");
    assert.ok(heart.y > main.y, "the trail stays below the flying heart");
  }
});

test("the heart uses the drawer's palette", () => {
  const palette = { bone: "#112233", joint: "#445566" };
  const participants = [
    participant(makePose(SELF), makeFigure({ palette }), "ACTIVE", 0),
    participant(makePose(TARGET), makeFigure(), "ACTIVE", 1),
  ];
  const director = startReaction("heart", participants);
  const props = director.props(CONFIG.figure.reactions.heart.durationMs * 0.5);

  assert.equal(props.colors.bone, palette.bone);
  assert.equal(props.colors.joint, palette.joint);
});
