/**
 * Central configuration: camera, pose model, geometric figure, eyes,
 * participants and the background environment.
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

    // MoveNet has no eyelids, so the eyes only read position and angle from
    // the tracking: confidence never changes their shape. The only opening and
    // closing is the autonomous blink below.
    eyes: {
      // Exponential time constants for the autonomous blink, in seconds.
      closeTime: 0.03,
      openTime: 0.09,
      // The figure blinks once every this many milliseconds. 0 disables it.
      autoBlinkMs: 2000,
      // How long the autonomous blink keeps the lids closed, in milliseconds.
      autoBlinkHoldMs: 120,
      // Keep the last position this long after the keypoint disappears.
      forgetMs: 700,
      // A fully closed eye is a thin line at this fraction of its open height.
      closedHeight: 0.08,
    },

    // Random palette per figure, rolled at birth. Ranges are chosen so the
    // black eyes and the accent accessories always keep contrast.
    palette: {
      saturation: [0.62, 0.95],
      bodyLightness: [0.62, 0.75],
      accentLightness: [0.8, 0.94],
      // Hue separation between body and accent, in degrees.
      hueSpread: [120, 240],
      // Minimum relative luminance of the body: keeps the black eyes readable.
      minBodyLuminance: 0.18,
      // Minimum luminance gap between the accent and the body.
      minAccentLuminanceGap: 0.1,
    },

    // One accessory is rolled at birth, one per figure.
    accessories: ["flower", "hat", "necklace"],

    // Small reactions played by one scene-level director. Every intervalMs it
    // picks ONE reaction from the reaction library (reactions/library.js) and
    // plays it; there is never more than one at a time. Reactions need both
    // participants on stage.
    reactions: {
      enabled: true,
      intervalMs: 10000,
      punch: {
        durationMs: 900,
        // Segment lengths as fractions of the body scale, used when the
        // punching arm keypoints are hidden at the moment of the punch.
        upperFallback: 0.85,
        forearmFallback: 0.73,
      },
      // A heart pops up between both bodies and flies to the top edge of the
      // page: the pair is in love. Position is the midpoint of both chests;
      // size is a fraction of the average body scale. It inflates like a
      // balloon and leaves a trail of smaller hearts behind.
      heart: {
        durationMs: 2800,
        size: 0.3,
        // Particle trail: small hearts spawn behind the main heart while it
        // flies, then drift and shrink during their short life.
        trail: {
          spawnMs: 150,
          lifeMs: 760,
          // Fresh particle size, as a fraction of the main heart at spawn.
          size: 0.28,
          // Spawn point below the main heart centre, as a fraction of its
          // size, so particles are not hidden inside the big heart.
          behind: 0.95,
          // Lateral spread and downward drift, as fractions of body scale.
          spread: 0.18,
          sink: 0.1,
          // Rotation added over the particle's life, in radians.
          spin: 0.6,
          // Stop spawning early enough for every particle to die with the prop.
          maxProgress: 0.7,
          max: 24,
        },
      },
      // One figure cries: tears spawn at its eyes, fall with gravity and
      // shrink. Sizes and distances are fractions of the body scale.
      cry: {
        durationMs: 5200,
        spawnMs: 90,
        lifeMs: 1200,
        // Tear half-width, as a fraction of the body scale.
        size: 0.09,
        // Downward motion: a constant speed plus gravity, as fractions of the
        // body scale over the tear's life.
        speed: 0.25,
        fall: 0.6,
        // Lateral drift, as a fraction of body scale.
        drift: 0.14,
        // After this delay the drops become one continuous wavy stream.
        streamAfterMs: 1500,
        stream: {
          // Stream length, wave amplitude and stroke width, as fractions of
          // the body scale.
          length: 1,
          amplitude: 0.16,
          width: 0.07,
          // Wave shape: cycles along the stream and travel speed (rad/s).
          cycles: 2.5,
          speed: 6,
          points: 24,
        },
        // Stop spawning early enough for every tear to die with the reaction.
        maxProgress: 0.72,
        max: 48,
      },
    },

    // The receiving side of a punch: a torso hitbox that detects the fist,
    // then knockback, a dizzy sway, rolling eyes and stars around the head.
    // Lengths are fractions of the body scale; star geometry is relative to
    // the head radius.
    impact: {
      durationMs: 1800,
      // Knockback push and return.
      knockbackMs: 650,
      knockback: 0.16,
      // Dizzy sway, in body scales and radians per second.
      sway: 0.05,
      swaySpeed: 6,
      // Rolling eyes.
      eyeSpeed: 8,
      eyeTilt: 0.35,
      // Radius of the torso hitbox, as a fraction of the body scale.
      hitboxRadius: 0.35,
      stars: {
        count: 4,
        // Orbit and star size, as fractions of the head radius.
        orbit: 1.3,
        size: 0.24,
        // Radians per second around the head.
        spin: 2.6,
        points: 5,
      },
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
      // Hands are only a circle: no fingers are tracked.
      handRadius: 0.15,
      upperArmThickness: 0.17,
      forearmThickness: 0.14,
      // Eye oval half-axes, as fractions of the figure's head radius, so the
      // tracking can never resize them. Taller than wide.
      eyeWidth: 0.16,
      eyeHeight: 0.24,
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
