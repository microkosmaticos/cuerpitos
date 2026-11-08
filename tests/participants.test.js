import test from "node:test";
import assert from "node:assert/strict";

import {
  ParticipantTracker,
  ParticipantState,
  SessionState,
} from "../participants.js";
import { Pose } from "../pose.js";
import { CONFIG } from "../config.js";

// Fast, deterministic timings for the state machine.
const config = {
  ...CONFIG.participants,
  acquireMs: 300,
  candidateMemoryMs: 200,
  lostGraceMs: 400,
  releaseBothMs: 1000,
  matching: { ...CONFIG.participants.matching },
};

function makeRaw({
  id,
  x,
  y = 240,
  scale = 100,
  score,
  confidence = 0.9,
}) {
  const keypoints = [
    {
      name: "nose",
      x,
      y: y - scale * 0.6,
      confidence,
    },
    {
      name: "left_shoulder",
      x: x - scale / 2,
      y: y - scale * 0.2,
      confidence,
    },
    {
      name: "right_shoulder",
      x: x + scale / 2,
      y: y - scale * 0.2,
      confidence,
    },
    {
      name: "left_hip",
      x: x - scale * 0.4,
      y: y + scale * 0.5,
      confidence,
    },
    {
      name: "right_hip",
      x: x + scale * 0.4,
      y: y + scale * 0.5,
      confidence,
    },
  ];

  const raw = {
    id,
    box: {
      xMin: x - scale / 2,
      yMin: y - scale * 0.7,
      xMax: x + scale / 2,
      yMax: y + scale * 0.6,
    },
    keypoints,
  };

  if (score !== undefined) raw.score = score;

  for (const point of keypoints) raw[point.name] = point;

  return raw;
}

function makePose(options) {
  return new Pose(makeRaw(options));
}

function makeTracker() {
  const tracker = new ParticipantTracker(config);
  tracker.setFrameSize(640, 480);
  return tracker;
}

function lockTwo(tracker, startNow = 0) {
  let now = startNow;
  let result;

  for (let i = 0; i < 6; i += 1) {
    now += 100;
    result = tracker.update(
      [makePose({ id: 1, x: 200 }), makePose({ id: 2, x: 440 })],
      now
    );
  }

  return { now, result };
}

test("1. selects two participants in the zone", () => {
  const tracker = makeTracker();
  const { result } = lockTwo(tracker);

  assert.equal(result.participants.length, 2);
  assert.equal(result.session, SessionState.LOCKED);
  assert.deepEqual(
    result.participants.map((participant) => participant.state),
    [ParticipantState.ACTIVE, ParticipantState.ACTIVE]
  );
  assert.notEqual(
    result.participants[0].participantId,
    result.participants[1].participantId
  );
});

test("uses keypoint confidence when the model omits pose.score", () => {
  const raw = makeRaw({ id: 1, x: 320 });
  const pose = new Pose(raw);

  assert.ok(pose.score > 0.5);

  const tracker = makeTracker();
  let now = 0;
  let result;

  for (let i = 0; i < 6; i += 1) {
    now += 100;
    result = tracker.update([new Pose(raw)], now);
  }

  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].state, ParticipantState.ACTIVE);
});

test("does not lock someone who only passes through", () => {
  const tracker = makeTracker();
  let now = 0;
  let result;

  for (let i = 0; i < 2; i += 1) {
    now += 100;
    result = tracker.update([makePose({ id: 1, x: 320 })], now);
  }

  assert.equal(result.participants.length, 0);

  for (let i = 0; i < 3; i += 1) {
    now += 100;
    result = tracker.update([], now);
  }

  assert.equal(result.participants.length, 0);
});

test("2. ignores a third person passing behind", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const lockedIds = locked.participants.map(
    (participant) => participant.participantId
  );

  let now = lockedAt;
  for (let i = 0; i < 10; i += 1) {
    now += 100;
    const result = tracker.update(
      [
        makePose({ id: 1, x: 200 }),
        makePose({ id: 2, x: 440 }),
        makePose({ id: 3, x: 560, y: 120, scale: 60, score: 0.99 }),
      ],
      now
    );

    assert.equal(result.participants.length, 2);
    assert.deepEqual(
      result.participants.map((participant) => participant.participantId),
      lockedIds
    );
    assert.ok(
      !result.participants.some((participant) => participant.trackId === 3)
    );
  }
});

test("3. does not replace a participant when a third person stays with higher confidence", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const lockedIds = locked.participants.map(
    (participant) => participant.participantId
  );

  let now = lockedAt;
  for (let i = 0; i < 20; i += 1) {
    now += 100;
    const result = tracker.update(
      [
        makePose({ id: 1, x: 200 }),
        makePose({ id: 2, x: 440 }),
        makePose({ id: 4, x: 320, y: 60, scale: 50, score: 0.99 }),
      ],
      now
    );

    assert.equal(result.participants.length, 2);
    assert.deepEqual(
      result.participants.map((participant) => participant.participantId),
      lockedIds
    );
    assert.deepEqual(
      result.participants.map((participant) => participant.trackId).sort(),
      [1, 2]
    );
  }
});

test("4. keeps identity when the tracker id changes during fast movement", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const first = locked.participants.find(
    (participant) => participant.trackId === 1
  );

  let now = lockedAt + 100;
  const result = tracker.update(
    [makePose({ id: 99, x: 260 }), makePose({ id: 2, x: 440 })],
    now
  );

  const same = result.participants.find(
    (participant) => participant.slotId === first.slotId
  );

  assert.equal(same.participantId, first.participantId);
  assert.equal(same.trackId, 99);
  assert.equal(same.state, ParticipantState.ACTIVE);
});

test("5. recovers a briefly hidden participant with the same identity", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const second = locked.participants.find(
    (participant) => participant.trackId === 2
  );

  let now = lockedAt;
  for (let i = 0; i < 3; i += 1) {
    now += 100;
    const result = tracker.update([makePose({ id: 1, x: 200 })], now);
    const slot = result.participants.find(
      (participant) => participant.slotId === second.slotId
    );

    assert.equal(slot.state, ParticipantState.LOST);
    assert.equal(slot.participantId, second.participantId);
  }

  now += 100;
  const result = tracker.update(
    [makePose({ id: 1, x: 200 }), makePose({ id: 22, x: 440 })],
    now
  );
  const recovered = result.participants.find(
    (participant) => participant.slotId === second.slotId
  );

  assert.equal(recovered.state, ParticipantState.ACTIVE);
  assert.equal(recovered.participantId, second.participantId);
  assert.equal(recovered.trackId, 22);
});

test("6. reserves the slot after a participant leaves and does not reassign it", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const second = locked.participants.find(
    (participant) => participant.trackId === 2
  );

  let now = lockedAt;
  for (let i = 0; i < 6; i += 1) {
    now += 100;
    tracker.update([makePose({ id: 1, x: 200 })], now);
  }

  now += 100;
  let result = tracker.update([makePose({ id: 1, x: 200 })], now);
  const absent = result.participants.find(
    (participant) => participant.slotId === second.slotId
  );

  assert.equal(absent.state, ParticipantState.ABSENT);
  assert.equal(absent.participantId, second.participantId);

  for (let i = 0; i < 8; i += 1) {
    now += 100;
    result = tracker.update(
      [
        makePose({ id: 1, x: 200 }),
        makePose({ id: 33, x: 340, y: 200, scale: 70 }),
      ],
      now
    );
  }

  const stillAbsent = result.participants.find(
    (participant) => participant.slotId === second.slotId
  );

  assert.equal(result.participants.length, 2);
  assert.equal(stillAbsent.participantId, second.participantId);
  assert.equal(stillAbsent.state, ParticipantState.ABSENT);
  assert.ok(
    !result.participants.some((participant) => participant.trackId === 33)
  );
});

test("7. releases both slots after both participants leave and allows a new session", () => {
  const tracker = makeTracker();
  const { now: lockedAt, result: locked } = lockTwo(tracker);
  const oldIds = locked.participants.map(
    (participant) => participant.participantId
  );

  let now = lockedAt;
  for (let i = 0; i < 12; i += 1) {
    now += 100;
    tracker.update([], now);
  }

  now += 100;
  const released = tracker.update([], now);

  assert.equal(released.participants.length, 0);
  assert.equal(released.session, SessionState.SELECTING);

  let result;
  for (let i = 0; i < 6; i += 1) {
    now += 100;
    result = tracker.update(
      [makePose({ id: 44, x: 180 }), makePose({ id: 45, x: 460 })],
      now
    );
  }

  assert.equal(result.participants.length, 2);
  assert.equal(result.session, SessionState.LOCKED);

  const newIds = result.participants.map(
    (participant) => participant.participantId
  );
  for (const id of newIds) {
    assert.ok(!oldIds.includes(id));
  }
});
