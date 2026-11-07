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

    // One colour pair per detected person, cycled by index.
    palette: [
      { bone: "#5ef2ff", joint: "#c6fbff" },
      { bone: "#ff7bd5", joint: "#ffd0ee" },
      { bone: "#b6ff7b", joint: "#e2ffcb" },
      { bone: "#ffd166", joint: "#fff0c2" },
      { bone: "#c39bff", joint: "#eadcff" },
    ],
  },
};
