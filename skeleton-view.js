import { CONFIG } from "./config.js";

/**
 * Skeleton renderer.
 *
 * Uses p5 in instance mode so it never pollutes globals. It draws only the
 * detected structure: joints as circles, bones as lines. The webcam image is
 * deliberately not drawn in stage 1.
 */
export class SkeletonView {
  constructor(container) {
    if (typeof p5 === "undefined") {
      throw new Error(
        "p5 no está cargado. Revisá el <script> de p5 en index.html"
      );
    }

    this.container = container;
    this.poses = [];
    this.connections = [];
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.upperBody = new Set(CONFIG.skeleton.upperBody);
    this.p = null;

    new p5((p) => this.createSketch(p), container);
  }

  createSketch(p) {
    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      this.p = p;
    };

    p.draw = () => this.render(p);

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  }

  setConnections(connections) {
    this.connections = connections ?? [];
  }

  setVideoSize(width, height) {
    this.videoWidth = width;
    this.videoHeight = height;
  }

  setPoses(poses) {
    this.poses = poses ?? [];
  }

  /**
   * "Cover" mapping: the video fills the viewport and the overflow is
   * cropped. This matches the framing the final installation will use when
   * the camera becomes the background.
   */
  transform(p) {
    if (!this.videoWidth || !this.videoHeight) return null;

    const scale = Math.max(
      p.width / this.videoWidth,
      p.height / this.videoHeight
    );

    return {
      scale,
      offsetX: (p.width - this.videoWidth * scale) / 2,
      offsetY: (p.height - this.videoHeight * scale) / 2,
    };
  }

  project(point, transform) {
    return {
      x: point.x * transform.scale + transform.offsetX,
      y: point.y * transform.scale + transform.offsetY,
    };
  }

  render(p) {
    p.background(0);

    const transform = this.transform(p);
    if (!transform) return;

    const { minConfidence, keypointRadius, boneWeight, palette } =
      CONFIG.skeleton;

    this.poses.forEach((pose, poseIndex) => {
      const colors = palette[poseIndex % palette.length];

      // Bones first so joints sit on top of the line ends.
      p.stroke(colors.bone);
      p.strokeWeight(boneWeight);
      p.noFill();

      for (const [aIndex, bIndex] of this.connections) {
        const a = pose.keypoints[aIndex];
        const b = pose.keypoints[bIndex];
        if (!a || !b) continue;
        if (!this.upperBody.has(a.name) || !this.upperBody.has(b.name)) {
          continue;
        }
        if (
          (a.confidence ?? 0) < minConfidence ||
          (b.confidence ?? 0) < minConfidence
        ) {
          continue;
        }

        const start = this.project(a, transform);
        const end = this.project(b, transform);
        p.line(start.x, start.y, end.x, end.y);
      }

      // Joints.
      p.noStroke();
      p.fill(colors.joint);

      for (const name of CONFIG.skeleton.upperBody) {
        const point = pose.get(name);
        if (!point) continue;
        if ((point.confidence ?? 0) < minConfidence) continue;

        const projected = this.project(point, transform);
        p.circle(projected.x, projected.y, keypointRadius * 2);
      }
    });
  }
}
