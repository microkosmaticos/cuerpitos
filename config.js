/**
 * Central configuration for stage 1: webcam + upper-body tracking.
 *
 * Every tunable value lives here so the rest of the code reads as behaviour,
 * not as magic numbers. Change the model name to "BlazePose" to try the
 * MediaPipe-based variant.
 */
export const CONFIG = {
  camera: {
    width: 640,
    height: 480,
    facingMode: "user",
  },

  model: {
    name: "MoveNet",
    // Safety cap on raw detections. This is NOT the number of participants:
    // the model may see more people, and ParticipantTracker decides which two
    // belong to the experience.
    maxDetections: 6,
    options: {
      // MULTIPOSE_LIGHTNING detects several people and keeps a stable id per
      // person, which is what the two-person stage will need.
      modelType: "MULTIPOSE_LIGHTNING",
      enableSmoothing: true,
      enableTracking: true,
      minPoseScore: 0.25,
      // agent.md: the image must not be mirrored horizontally.
      flipHorizontal: false,
    },
  },

  skeleton: {
    // Keypoints below this confidence are not drawn.
    minConfidence: 0.3,
    keypointRadius: 7,
    boneWeight: 3,
    // Present the skeleton as a mirror: the person's right hand appears on
    // the viewer's right, like looking into a mirror.
    mirror: true,

    head: {
      // Factors are multiplied by a reference distance (ears, eyes or
      // shoulders) to keep the head circle proportional to each body.
      earFactor: 0.75,
      eyeFactor: 1.6,
      shoulderFactor: 0.18,
      // Minimum radius in video pixels, for when the face is partly hidden.
      minRadius: 16,
      neckWeight: 3,
    },

    // Rig build aid: write each joint's rig name next to the point, using the
    // armature naming from rig.js. Turn off for the installation look.
    showJointNames: true,
    jointLabelSize: 11,
    jointLabelOffset: 10,

    // MoveNet keypoint names that make up head, torso and upper limbs.
    // Knee and ankle connections are automatically excluded.
    upperBody: [
      "nose",
      "left_eye",
      "right_eye",
      "left_ear",
      "right_ear",
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
    ],

    // One colour pair per participant slot (0 and 1), so colours stay stable
    // while a participant moves and even if MoveNet changes their track id.
    palette: [
      { bone: "#5ef2ff", joint: "#c6fbff" },
      { bone: "#ff7bd5", joint: "#ffd0ee" },
      { bone: "#b6ff7b", joint: "#e2ffcb" },
      { bone: "#ffd166", joint: "#fff0c2" },
      { bone: "#c39bff", joint: "#eadcff" },
    ],
  },

  figure: {
    // Geometric body that replaces the tracking skeleton on screen.
    enabled: true,
    // Draw the tracking skeleton under the figure. Debug only.
    showSkeleton: false,
    strokeWeight: 2,
    // Corner radius of the rectangles, as a fraction of their short side, so
    // the body reads as soft as the circles and ovals.
    cornerRatio: 0.35,
    // Oval eyes, placed on the tracked eye keypoints.
    eyeColor: "#000000",

    // MoveNet has no eyelids, so openness is inferred from the eye keypoint:
    // if it disappears the lid closes (blink), and a confidence drop narrows
    // it (squint). Both are smoothed over time.
    eyes: {
      // Confidence at which the eye counts as fully open.
      openConfidence: 0.55,
      // Openness reached at the minimum confidence while the eye is tracked.
      minOpenness: 0.25,
      // Exponential time constants, in seconds. Fast close and quick reopen
      // keep the lids faithful to the real blink.
      closeTime: 0.03,
      openTime: 0.09,
      // A blink shorter than this still reads as a blink, in milliseconds.
      minBlinkMs: 90,
      // Keep the last position this long after the keypoint disappears, so a
      // blink closes in place instead of popping out.
      forgetMs: 700,
      // A fully closed eye is a thin line at this fraction of its open height.
      closedHeight: 0.08,
    },

    // Rolled once per participant when it is locked, kept for the session.
    // A new participant is a new body.
    proportions: {
      // Width multiplier: 0.55 is thin, 1.9 is wide.
      girth: [0.55, 1.9],
      // Shoulder->elbow and elbow->wrist length multiplier.
      armLength: [0.8, 1.35],
      // Head radius as a fraction of the detected shoulder width.
      headSize: [0.16, 0.42],
      // Whole-body scale, applied around the chest. 0.6 is a small character,
      // 1.5 is a large one.
      size: [0.6, 1.5],
    },

    // Ratios of the detected shoulder width.
    ratios: {
      chestThickness: 1.0,
      // Chest length when the hips are not visible (waist-up framing).
      chestLength: 0.9,
      shoulderRadius: 0.13,
      elbowRadius: 0.13,
      upperArmThickness: 0.17,
      forearmThickness: 0.14,
      // Eye oval half-axes, as fractions of the tracked eye separation.
      // Taller than wide: vertical ovals, a bit larger than the previous eyes.
      eyeWidth: 0.2,
      eyeHeight: 0.3,
      // Eye separation fallback (fraction of head radius) when only one eye
      // is visible and the distance between both cannot be measured.
      eyeFallbackSeparation: 0.55,
    },
  },

  participants: {
    // The experience never shows more than two participants.
    maxActive: 2,

    // Normalized participation zone. People outside it are not candidates.
    zone: { xMin: 0.15, xMax: 0.85, yMin: 0, yMax: 1 },

    // A candidate must stay stable this long before being locked.
    acquireMs: 1400,
    // How long an unmatched candidate is remembered across id changes.
    candidateMemoryMs: 700,
    // Temporary occlusion tolerance per participant.
    lostGraceMs: 2000,
    // The session only resets after BOTH participants are gone this long.
    releaseBothMs: 6000,
    // Optional per-slot release when one participant stays. Disabled on
    // purpose: the empty seat stays reserved until the session ends.
    singleSlotReleaseMs: null,
    maxCandidates: 4,
    minPoseScore: 0.25,

    // Reference shoulder-width / frame-width ratios for the size score.
    sizeMinRatio: 0.08,
    sizeMaxRatio: 0.35,

    weights: {
      centrality: 0.4,
      stability: 0.25,
      size: 0.2,
      confidence: 0.15,
    },

    matching: {
      // Maximum centre distance, in body scales, from the predicted position.
      maxCenterDistanceNorm: 1.2,
      maxScaleRatio: 0.5,
      maxCost: 0.75,
      // Stricter threshold for a participant already marked ABSENT.
      absentMaxCost: 0.6,
      velocitySmoothing: 0.35,
      // Maximum predicted speed, in body scales per second.
      maxVelocityNorm: 3,
      velocityDecay: 0.85,
    },

    debug: {
      // Draw non-participants in grey. Off for the installation.
      showIgnored: false,
    },
  },
};
