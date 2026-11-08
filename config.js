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
