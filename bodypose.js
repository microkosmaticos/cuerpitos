import { CONFIG } from "./config.js";

/**
 * Pose detection model.
 *
 * Wraps ml5 bodyPose so the rest of the app never imports ml5 directly.
 * Receives a video element, emits raw poses through a callback.
 */
export class BodyPoseModel {
  constructor() {
    this.model = null;
    this.connections = [];
    this.running = false;
  }

  async load() {
    if (this.model) return this.model;

    if (typeof ml5 === "undefined") {
      throw new Error(
        "ml5 no está cargado. Revisá el <script> de ml5 en index.html"
      );
    }

    // ml5.bodyPose() returns the instance immediately, not a promise. The
    // model finishes loading on `instance.ready`, and detectStart() does not
    // wait for it, so we must await it here before starting detection.
    const instance = ml5.bodyPose(CONFIG.model.name, CONFIG.model.options);
    await instance.ready;

    this.model = instance;
    this.connections = this.model.getSkeleton();

    return this.model;
  }

  start(video, onPoses) {
    if (!this.model) {
      throw new Error("El modelo no está cargado. Llamá a load() primero.");
    }
    if (this.running) {
      this.model.detectStop();
    }

    this.model.detectStart(video, (poses) => {
      onPoses(this.capDetections(poses));
    });
    this.running = true;
  }

  /**
   * Safety cap only. The detection layer must not decide who participates:
   * ParticipantTracker owns selection and the two-participant limit.
   */
  capDetections(poses) {
    const max = CONFIG.model.maxDetections;
    if (!max || poses.length <= max) return poses;

    return [...poses]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, max);
  }

  stop() {
    if (this.model) {
      this.model.detectStop();
    }
    this.running = false;
  }
}
