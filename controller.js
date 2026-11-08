import { CameraModel } from "./camera.js";
import { BodyPoseModel } from "./bodypose.js";
import { Pose } from "./pose.js";
import { ParticipantTracker } from "./participants.js";
import { SkeletonView } from "./skeleton-view.js";
import { CONFIG } from "./config.js";

/**
 * Orchestrator.
 *
 * Wiring order: camera -> detection -> participant lock -> view.
 * The view never sees raw detections, only the locked participants (plus the
 * ignored ones for optional debug drawing).
 */
export class AppController {
  constructor({ container, hud }) {
    this.hud = hud;
    this.view = new SkeletonView(container);
    this.camera = new CameraModel();
    this.bodyPose = new BodyPoseModel();
    this.tracker = new ParticipantTracker();

    this.lastResult = {
      participants: [],
      ignored: [],
      session: "SELECTING",
    };

    this.frameCount = 0;
    this.fps = 0;
    this.fpsStartedAt = performance.now();
  }

  async start() {
    this.setStatus("encendiendo cámara…");

    try {
      await this.camera.start();
      this.view.setVideoSize(this.camera.width, this.camera.height);
      this.tracker.setFrameSize(this.camera.width, this.camera.height);

      this.setStatus("cargando modelo…");
      await this.bodyPose.load();
      this.view.setConnections(this.bodyPose.connections);

      this.setStatus("buscando participantes…");
      this.bodyPose.start(this.camera.video, (poses) => this.onPoses(poses));
    } catch (error) {
      console.error(error);
      this.setStatus(error.message, true);
    }
  }

  onPoses(rawPoses) {
    const poses = rawPoses.map((raw) => new Pose(raw));
    const result = this.tracker.update(poses, performance.now());
    this.lastResult = result;

    this.view.setParticipants(result.participants);
    this.view.setIgnored(result.ignored);

    this.frameCount += 1;
    const now = performance.now();
    const elapsed = now - this.fpsStartedAt;

    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsStartedAt = now;
      this.setStatus(this.describe(result));
    }
  }

  describe(result) {
    const states = result.participants
      .map((participant) => `P${participant.slotId + 1}:${participant.state}`)
      .join(" · ");

    const head = `${result.session} · ${result.participants.length}/${CONFIG.participants.maxActive}`;
    return `${head}${states ? ` · ${states}` : ""}  ·  fps: ${this.fps}`;
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
