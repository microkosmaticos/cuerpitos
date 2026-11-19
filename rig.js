/**
 * Rig naming for the tracked upper body.
 *
 * MoveNet returns anatomical keypoints, not rig joints. This module names
 * every one of them the way an armature expects, so the live skeleton can be
 * checked against the rig that will drive the organisms.
 *
 * Convention: Blender / Rigify — lowercase snake_case with `.L` and `.R`
 * suffixes, so a future armature mirrors and auto-weights without renaming.
 * Legs are out of scope: the framing is waist-up (see agent.md).
 */

/**
 * Detected keypoint -> rig joint that it positions.
 *
 * A keypoint is the head (start) of the bone that leaves it: `left_elbow`
 * positions the head of `forearm.L`, which ends at `wrist.L`.
 */
export const RIG_JOINT_NAMES = Object.freeze({
  // Head markers: they do not articulate, they anchor the head circle.
  nose: "nose",
  left_eye: "eye.L",
  right_eye: "eye.R",
  left_ear: "ear.L",
  right_ear: "ear.R",

  // Arms.
  left_shoulder: "shoulder.L",
  right_shoulder: "shoulder.R",
  left_elbow: "elbow.L",
  right_elbow: "elbow.R",
  left_wrist: "wrist.L",
  right_wrist: "wrist.R",

  // Hips. Knees and ankles are outside the waist-up framing.
  left_hip: "hip.L",
  right_hip: "hip.R",
});

/**
 * Joints that MoveNet does not provide but a rig needs. Each is computed from
 * visible keypoints so a rig can be built without extra detection:
 *
 *   pelvis     midpoint of both hips.
 *   chest      midpoint of both shoulders.
 *   head       centre of the head circle: ears, then eyes, then nose.
 *   skull_base point of the head circle facing the chest; the neck ends here.
 *   head_top   point of the head circle facing away from the chest.
 *   hand_tip   wrist extended along the forearm; the hand bone ends here.
 */
export const RIG_SYNTHETIC_JOINTS = Object.freeze([
  "pelvis",
  "chest",
  "head",
  "skull_base",
  "head_top",
  "hand_tip.L",
  "hand_tip.R",
]);

/**
 * Bone hierarchy, parent first. `head` and `tail` are joint names from
 * RIG_JOINT_NAMES or RIG_SYNTHETIC_JOINTS; they are the two ends of the bone.
 *
 * `spine` is the root because the visible torso is a single segment. Raise
 * the root to `pelvis` and add `thigh.L` / `thigh.R` when the framing widens.
 */
export const RIG_BONES = Object.freeze([
  { name: "spine", parent: null, head: "pelvis", tail: "chest" },
  { name: "neck", parent: "spine", head: "chest", tail: "skull_base" },
  { name: "head", parent: "neck", head: "skull_base", tail: "head_top" },

  { name: "clavicle.L", parent: "spine", head: "chest", tail: "shoulder.L" },
  {
    name: "upper_arm.L",
    parent: "clavicle.L",
    head: "shoulder.L",
    tail: "elbow.L",
  },
  {
    name: "forearm.L",
    parent: "upper_arm.L",
    head: "elbow.L",
    tail: "wrist.L",
  },
  { name: "hand.L", parent: "forearm.L", head: "wrist.L", tail: "hand_tip.L" },

  { name: "clavicle.R", parent: "spine", head: "chest", tail: "shoulder.R" },
  {
    name: "upper_arm.R",
    parent: "clavicle.R",
    head: "shoulder.R",
    tail: "elbow.R",
  },
  {
    name: "forearm.R",
    parent: "upper_arm.R",
    head: "elbow.R",
    tail: "wrist.R",
  },
  { name: "hand.R", parent: "forearm.R", head: "wrist.R", tail: "hand_tip.R" },
]);

/** Rig name for a MoveNet keypoint, or null when it has no rig meaning. */
export function rigNameFor(keypointName) {
  return RIG_JOINT_NAMES[keypointName] ?? null;
}

/**
 * Keypoints that only build the head. They are named in RIG_JOINT_NAMES so the
 * map is complete, but they are markers, not articulations, so the skeleton
 * view does not label them: five overlapping labels around one face is noise.
 */
export const RIG_HEAD_MARKERS = Object.freeze([
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
]);
