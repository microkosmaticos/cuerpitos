import { CONFIG } from "./config.js";

/**
 * Skeleton renderer.
 *
 * Uses p5 in instance mode so it never pollutes globals. It draws only the
 * detected structure: joints as circles, bones as lines, plus a neck line and
 * a head circle. The webcam image is deliberately not drawn in stage 1.
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
      width: p.width,
    };
  }

  project(point, transform) {
    const x = point.x * transform.scale + transform.offsetX;
    return {
      // Mirror the final position so movement feels like a reflection.
      x: CONFIG.skeleton.mirror ? transform.width - x : x,
      y: point.y * transform.scale + transform.offsetY,
    };
  }

  visiblePoint(pose, name) {
    const point = pose.get(name);
    if (!point) return null;
    if ((point.confidence ?? 0) < CONFIG.skeleton.minConfidence) return null;
    return point;
  }

  midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
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

      // Neck + head, drawn between bones and joints.
      this.drawHead(p, pose, colors, transform);

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

  /**
   * Head structure: a neck line from the shoulder midpoint to the border of a
   * head circle. The circle is centred on the ears (falling back to eyes or
   * nose) and scales with the body so every person gets a proportional head.
   */
  drawHead(p, pose, colors, transform) {
    const head = CONFIG.skeleton.head;

    const leftEar = this.visiblePoint(pose, "left_ear");
    const rightEar = this.visiblePoint(pose, "right_ear");
    const leftEye = this.visiblePoint(pose, "left_eye");
    const rightEye = this.visiblePoint(pose, "right_eye");
    const nose = this.visiblePoint(pose, "nose");
    const leftShoulder = this.visiblePoint(pose, "left_shoulder");
    const rightShoulder = this.visiblePoint(pose, "right_shoulder");

    const ears = leftEar && rightEar ? this.midpoint(leftEar, rightEar) : null;
    const eyes = leftEye && rightEye ? this.midpoint(leftEye, rightEye) : null;
    const center = ears ?? eyes ?? nose;
    if (!center) return;

    const shoulderCenter =
      leftShoulder && rightShoulder
        ? this.midpoint(leftShoulder, rightShoulder)
        : null;

    const earDistance = leftEar && rightEar ? this.distance(leftEar, rightEar) : 0;
    const eyeDistance = leftEye && rightEye ? this.distance(leftEye, rightEye) : 0;
    const shoulderWidth =
      leftShoulder && rightShoulder
        ? this.distance(leftShoulder, rightShoulder)
        : 0;

    const radius = Math.max(
      earDistance * head.earFactor,
      eyeDistance * head.eyeFactor,
      shoulderWidth * head.shoulderFactor,
      head.minRadius
    );

    const projectedCenter = this.project(center, transform);
    const projectedRadius = radius * transform.scale;

    // Neck: from the shoulder midpoint to the circle border, so the line does
    // not pierce the head.
    if (shoulderCenter) {
      const projectedShoulders = this.project(shoulderCenter, transform);
      const dx = projectedShoulders.x - projectedCenter.x;
      const dy = projectedShoulders.y - projectedCenter.y;
      const length = Math.hypot(dx, dy) || 1;
      const neckEnd = {
        x: projectedCenter.x + (dx / length) * projectedRadius,
        y: projectedCenter.y + (dy / length) * projectedRadius,
      };

      p.stroke(colors.bone);
      p.strokeWeight(head.neckWeight);
      p.line(
        projectedShoulders.x,
        projectedShoulders.y,
        neckEnd.x,
        neckEnd.y
      );
    }

    // Head circle.
    p.noFill();
    p.stroke(colors.joint);
    p.strokeWeight(head.neckWeight);
    p.circle(
      projectedCenter.x,
      projectedCenter.y,
      projectedRadius * 2
    );
  }
}
