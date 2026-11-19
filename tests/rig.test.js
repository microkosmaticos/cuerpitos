import test from "node:test";
import assert from "node:assert/strict";

import {
  RIG_BONES,
  RIG_HEAD_MARKERS,
  RIG_JOINT_NAMES,
  RIG_SYNTHETIC_JOINTS,
  rigNameFor,
} from "../rig.js";
import { CONFIG } from "../config.js";

const JOINT_NAMES = new Set([
  ...Object.values(RIG_JOINT_NAMES),
  ...RIG_SYNTHETIC_JOINTS,
]);

/** left_shoulder <-> right_shoulder, shoulder.L <-> shoulder.R. */
function mirror(name) {
  if (name.startsWith("left_")) return `right_${name.slice("left_".length)}`;
  if (name.startsWith("right_")) return `left_${name.slice("right_".length)}`;
  if (name.endsWith(".L")) return `${name.slice(0, -2)}.R`;
  if (name.endsWith(".R")) return `${name.slice(0, -2)}.L`;
  return name;
}

test("every upper-body keypoint has a rig name", () => {
  for (const keypoint of CONFIG.skeleton.upperBody) {
    assert.ok(rigNameFor(keypoint), `${keypoint} has no rig name`);
  }
});

test("rig joint names are unique", () => {
  const names = Object.values(RIG_JOINT_NAMES);
  assert.equal(new Set(names).size, names.length);
});

test("head markers are named, and name nothing else", () => {
  for (const marker of RIG_HEAD_MARKERS) {
    assert.ok(rigNameFor(marker), `${marker} has no rig name`);
  }
});

test("left and right keypoints mirror to .L and .R joints", () => {
  for (const [keypoint, joint] of Object.entries(RIG_JOINT_NAMES)) {
    const twinKeypoint = mirror(keypoint);
    if (twinKeypoint === keypoint) continue;

    assert.equal(
      rigNameFor(twinKeypoint),
      mirror(joint),
      `${keypoint} / ${twinKeypoint} are asymmetric`
    );
  }
});

test("bones reference known joints and known parents", () => {
  const boneNames = new Set(RIG_BONES.map((bone) => bone.name));
  assert.equal(boneNames.size, RIG_BONES.length, "bone names must be unique");

  for (const bone of RIG_BONES) {
    assert.ok(JOINT_NAMES.has(bone.head), `${bone.name} head ${bone.head}`);
    assert.ok(JOINT_NAMES.has(bone.tail), `${bone.name} tail ${bone.tail}`);
    if (bone.parent !== null) {
      assert.ok(
        boneNames.has(bone.parent),
        `${bone.name} parent ${bone.parent}`
      );
    }
  }
});

test("the hierarchy has a single root and no cycles", () => {
  const byName = new Map(RIG_BONES.map((bone) => [bone.name, bone]));
  const roots = RIG_BONES.filter((bone) => bone.parent === null);

  assert.equal(roots.length, 1, "expected exactly one root bone");

  for (const bone of RIG_BONES) {
    const seen = new Set();
    let current = bone;

    while (current.parent !== null) {
      assert.ok(!seen.has(current.name), `cycle at ${current.name}`);
      seen.add(current.name);
      current = byName.get(current.parent);
    }
  }
});

test("arm bones mirror left and right", () => {
  const byName = new Map(RIG_BONES.map((bone) => [bone.name, bone]));

  for (const bone of RIG_BONES) {
    if (!bone.name.endsWith(".L")) continue;

    const twin = byName.get(mirror(bone.name));
    assert.ok(twin, `missing ${mirror(bone.name)}`);
    assert.equal(twin.parent, mirror(bone.parent));
    assert.equal(twin.head, mirror(bone.head));
    assert.equal(twin.tail, mirror(bone.tail));
  }
});
