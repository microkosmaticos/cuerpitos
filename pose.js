import { CONFIG } from "./config.js";

const TORSO_KEYS = [
  "left_shoulder",
  "right_shoulder",
  "left_hip",
  "right_hip",
];

/**
 * One detected person.
 *
 * ml5 returns keypoints as an array plus named shortcuts. This class exposes
 * a small, intention-revealing API and precomputes the geometry the
 * ParticipantTracker needs: bounding box, torso centre and body scale.
 *
 * All coordinates are in real video pixels. The mirror is a view concern and
 * never touches this data.
 */
export class Pose {
  constructor(rawPose = {}) {
    this.raw = rawPose;
    this.keypoints = rawPose.keypoints ?? [];
    this.score =
      rawPose.score ?? rawPose.box?.score ?? this.computeScoreFromKeypoints();
    this.id = rawPose.id ?? null;
    this.trackId = this.id;

    this.box = this.computeBox(rawPose.box);
    this.center = this.computeCenter();
    this.scale = this.computeScale();
  }

  get(name) {
    return this.raw[name];
  }

  isVisible(name, minConfidence = CONFIG.skeleton.minConfidence) {
    const point = this.get(name);
    if (!point) return false;
    return (point.confidence ?? 0) >= minConfidence;
  }

  /**
   * A usable upper body: at least one shoulder plus another torso point.
   * Hips are optional because the installation framing is waist-up.
   */
  hasTorso() {
    let shoulders = 0;
    let hips = 0;
    if (this.isVisible("left_shoulder")) shoulders += 1;
    if (this.isVisible("right_shoulder")) shoulders += 1;
    if (this.isVisible("left_hip")) hips += 1;
    if (this.isVisible("right_hip")) hips += 1;
    return shoulders >= 1 && shoulders + hips >= 2;
  }

  /**
   * MoveNet MULTIPOSE does not always expose a top-level or box score, so we
   * fall back to the average keypoint confidence.
   */
  computeScoreFromKeypoints() {
    const points = this.keypoints.filter((point) =>
      Number.isFinite(point.confidence ?? point.score)
    );
    if (points.length === 0) return 0;

    return (
      points.reduce(
        (sum, point) => sum + (point.confidence ?? point.score ?? 0),
        0
      ) / points.length
    );
  }

  computeBox(rawBox) {
    if (
      rawBox &&
      Number.isFinite(rawBox.xMin) &&
      Number.isFinite(rawBox.yMin) &&
      rawBox.xMax > rawBox.xMin &&
      rawBox.yMax > rawBox.yMin
    ) {
      return {
        xMin: rawBox.xMin,
        yMin: rawBox.yMin,
        xMax: rawBox.xMax,
        yMax: rawBox.yMax,
      };
    }

    const points = this.keypoints.filter(
      (point) => (point.confidence ?? 0) >= CONFIG.skeleton.minConfidence
    );
    if (points.length === 0) return null;

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      xMin: Math.min(...xs),
      yMin: Math.min(...ys),
      xMax: Math.max(...xs),
      yMax: Math.max(...ys),
    };
  }

  computeCenter() {
    const points = TORSO_KEYS.map((name) => this.get(name)).filter(
      (point) =>
        point && (point.confidence ?? 0) >= CONFIG.skeleton.minConfidence
    );

    if (points.length > 0) {
      const totalWeight =
        points.reduce((sum, point) => sum + (point.confidence ?? 0), 0) || 1;
      return {
        x:
          points.reduce(
            (sum, point) => sum + point.x * (point.confidence ?? 0),
            0
          ) / totalWeight,
        y:
          points.reduce(
            (sum, point) => sum + point.y * (point.confidence ?? 0),
            0
          ) / totalWeight,
      };
    }

    if (this.box) {
      return {
        x: (this.box.xMin + this.box.xMax) / 2,
        y: (this.box.yMin + this.box.yMax) / 2,
      };
    }

    return { x: 0, y: 0 };
  }

  computeScale() {
    const leftShoulder = this.get("left_shoulder");
    const rightShoulder = this.get("right_shoulder");
    if (
      leftShoulder &&
      rightShoulder &&
      (leftShoulder.confidence ?? 0) >= CONFIG.skeleton.minConfidence &&
      (rightShoulder.confidence ?? 0) >= CONFIG.skeleton.minConfidence
    ) {
      return Math.hypot(
        leftShoulder.x - rightShoulder.x,
        leftShoulder.y - rightShoulder.y
      );
    }

    const leftHip = this.get("left_hip");
    const rightHip = this.get("right_hip");
    if (
      leftHip &&
      rightHip &&
      (leftHip.confidence ?? 0) >= CONFIG.skeleton.minConfidence &&
      (rightHip.confidence ?? 0) >= CONFIG.skeleton.minConfidence
    ) {
      return Math.hypot(leftHip.x - rightHip.x, leftHip.y - rightHip.y);
    }

    if (this.box) {
      return Math.max(1, this.box.xMax - this.box.xMin);
    }

    return 1;
  }
}
