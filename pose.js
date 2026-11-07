import { CONFIG } from "./config.js";

/**
 * One detected person.
 *
 * ml5 returns keypoints as an array plus named shortcuts. This class exposes
 * a small, intention-revealing API so drawing code does not juggle array
 * indices or confidence checks.
 */
export class Pose {
  constructor(rawPose = {}) {
    this.raw = rawPose;
    this.keypoints = rawPose.keypoints ?? [];
    this.score = rawPose.score ?? 0;
    this.id = rawPose.id ?? null;
  }

  get(name) {
    return this.raw[name];
  }

  isVisible(name, minConfidence = CONFIG.skeleton.minConfidence) {
    const point = this.get(name);
    if (!point) return false;
    return (point.confidence ?? 0) >= minConfidence;
  }

  hasTorso() {
    return this.isVisible("left_shoulder") || this.isVisible("right_shoulder");
  }
}
