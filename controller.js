import { CameraModel } from "./camera.js";
import { BodyPoseModel } from "./bodypose.js";
import { Pose } from "./pose.js";
import { SkeletonView } from "./skeleton-view.js";
import { CONFIG } from "./config.js";

/**
 * Orchestrator.
 *
 * Owns the wiring order (camera -> model -> view) and translates raw
 * detections into view updates. It knows neither ml5 nor p5 APIs.
 */
export class AppController {
  constructor({ container, hud }) {
    this.hud = hud;
    this.view = new SkeletonView(container);
    this.camera = new CameraModel();
    this.bodyPose = new BodyPoseModel();

    this.frameCount = 0;
    this.fps = 0;
    this.fpsStartedAt = performance.now();
  }

  async start() {
    this.setStatus("encendiendo cámara…");

    try {
      await this.camera.start();
      this.view.setVideoSize(this.camera.width, this.camera.height);

      this.setStatus("cargando modelo…");
      await this.bodyPose.load();
      this.view.setConnections(this.bodyPose.connections);

      this.setStatus("detectando…");
      this.bodyPose.start(this.camera.video, (poses) => this.onPoses(poses));
    } catch (error) {
      console.error(error);
      this.setStatus(error.message, true);
    }
  }

  onPoses(rawPoses) {
    const poses = rawPoses.map((raw) => new Pose(raw));
    this.view.setPoses(poses);

    this.frameCount += 1;
    const now = performance.now();
    const elapsed = now - this.fpsStartedAt;

    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsStartedAt = now;
      this.setStatus(`personas: ${poses.length}/${CONFIG.model.maxPoses}  ·  fps: ${this.fps}`);
    }
  }

  setStatus(text, isError = false) {
    if (!this.hud) return;
    this.hud.textContent = text;
    this.hud.dataset.error = isError ? "true" : "false";
  }

  stop() {
    this.bodyPose.stop();
    this.camera.stop();
  }
}
