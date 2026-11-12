import { CONFIG } from "./config.js";
import { RIG_HEAD_MARKERS, rigNameFor } from "./rig.js";

/**
 * Skeleton renderer.
 *
 * Draws only the locked participants. Colour is keyed by slotId, so it stays
 * stable while a participant moves or MoveNet changes their track id.
 * Non-participants are ignored unless debug.showIgnored is enabled.
 */
export class SkeletonView {
  constructor(container) {
    if (typeof p5 === "undefined") {
      throw new Error(
        "p5 no está cargado. Revisá el <script> de p5 en index.html"
      );
    }

    this.container = container;
    this.participants = [];
    this.ignored = [];
    this.connections = [];
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.upperBody = new Set(CONFIG.skeleton.upperBody);
    this.headMarkers = new Set(RIG_HEAD_MARKERS);
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

  setParticipants(participants) {
    this.participants = participants ?? [];
  }

  setIgnored(poses) {
    this.ignored = poses ?? [];
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

  withAlpha(p, hex, alpha) {
    const color = p.color(hex);
    color.setAlpha(alpha * 255);
    return color;
  }

  render(p) {
    p.background(0);

    const transform = this.transform(p);
    if (!transform) return;

    if (CONFIG.participants.debug.showIgnored) {
      for (const pose of this.ignored) {
        this.drawPose(
          p,
          pose,
          transform,
          { bone: "#333333", joint: "#4d4d4d" },
          0.35,
          false
        );
      }
    }

    for (const participant of this.participants) {
      if (!participant.pose) continue;
      if (participant.state === "ABSENT") continue;

      const palette = CONFIG.skeleton.palette;
      const colors = palette[participant.slotId % palette.length];
      const alpha = participant.state === "LOST" ? 0.4 : 1;

      // The skeleton is a debug layer: it sits under the geometric body.
      if (CONFIG.figure.showSkeleton || !CONFIG.figure.enabled) {
        this.drawPose(p, participant.pose, transform, colors, alpha, true);
      }

      if (CONFIG.figure.enabled && participant.figure) {
        this.drawFigure(
          p,
          participant.figure,
          participant.pose,
          transform,
          colors,
          alpha
        );
      }
    }
  }

  /**
   * Geometric body. Shapes arrive in video coordinates, so the same mirror and
   * cover transform used by the skeleton applies here.
   */
  drawFigure(p, figure, pose, transform, colors, alpha) {
    const shapes = figure.shapes(pose);
    const scale = transform.scale;

    p.stroke(this.withAlpha(p, colors.joint, alpha));
    p.strokeWeight(CONFIG.figure.strokeWeight);
    p.fill(this.withAlpha(p, colors.bone, alpha));

    for (const shape of shapes) {
      const center = this.project(shape, transform);

      if (shape.kind === "circle") {
        p.circle(center.x, center.y, shape.radius * 2 * scale);
        continue;
      }

      if (shape.kind !== "rectangle") continue;

      p.push();
      p.translate(center.x, center.y);
      // Mirroring flips x, which reverses the rotation direction.
      p.rotate(CONFIG.skeleton.mirror ? -shape.angle : shape.angle);
      p.rectMode(p.CENTER);
      p.rect(0, 0, shape.length * scale, shape.thickness * scale);
      p.pop();
    }
  }

  drawPose(p, pose, transform, colors, alpha, drawHead) {
    const { minConfidence, keypointRadius, boneWeight } = CONFIG.skeleton;

    // Bones first so joints sit on top of the line ends.
    p.stroke(this.withAlpha(p, colors.bone, alpha));
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

    if (drawHead) {
      this.drawHead(p, pose, colors, transform, alpha);
    }

    // Joints.
    p.noStroke();
    p.fill(this.withAlpha(p, colors.joint, alpha));

    for (const name of CONFIG.skeleton.upperBody) {
      const point = pose.get(name);
      if (!point) continue;
      if ((point.confidence ?? 0) < minConfidence) continue;

      const projected = this.project(point, transform);
      p.circle(projected.x, projected.y, keypointRadius * 2);
    }

    if (CONFIG.skeleton.showJointNames) {
      this.drawJointNames(p, pose, transform, colors, alpha);
    }
  }

  /**
   * Writes the rig name of every visible joint. Head markers are skipped:
   * they build the head, they do not articulate. `chest`, `pelvis` and `head`
   * are synthetic joints, so they are labelled from their own geometry.
   */
  drawJointNames(p, pose, transform, colors, alpha) {
    const { minConfidence } = CONFIG.skeleton;

    p.textFont("monospace");
    p.textSize(CONFIG.skeleton.jointLabelSize);
    p.fill(this.withAlpha(p, colors.joint, alpha));

    for (const name of CONFIG.skeleton.upperBody) {
      if (this.headMarkers.has(name)) continue;

      const point = pose.get(name);
      if (!point) continue;
      if ((point.confidence ?? 0) < minConfidence) continue;

      this.drawJointName(p, rigNameFor(name), this.project(point, transform));
    }

    const leftShoulder = this.visiblePoint(pose, "left_shoulder");
    const rightShoulder = this.visiblePoint(pose, "right_shoulder");
    if (leftShoulder && rightShoulder) {
      const chest = this.midpoint(leftShoulder, rightShoulder);
      this.drawJointName(p, "chest", this.project(chest, transform));
    }

    const leftHip = this.visiblePoint(pose, "left_hip");
    const rightHip = this.visiblePoint(pose, "right_hip");
    if (leftHip && rightHip) {
      const pelvis = this.midpoint(leftHip, rightHip);
      this.drawJointName(p, "pelvis", this.project(pelvis, transform));
    }

    const head = pose.headCenter();
    if (head) {
      this.drawJointName(p, "head", this.project(head, transform));
    }
  }

  /** Labels flip toward the canvas centre so they never leave the frame. */
  drawJointName(p, name, projected) {
    if (!name) return;

    const offset = CONFIG.skeleton.jointLabelOffset;
    const alignRight = projected.x + offset + p.textWidth(name) > p.width;

    p.textAlign(alignRight ? p.RIGHT : p.LEFT, p.BOTTOM);
    p.text(
      name,
      projected.x + (alignRight ? -offset : offset),
      projected.y - offset
    );
  }

  /**
   * Head structure: a neck line from the shoulder midpoint to the border of a
   * head circle. The circle is centred on the ears (falling back to eyes or
   * nose) and scales with the body so every person gets a proportional head.
   */
  drawHead(p, pose, colors, transform, alpha) {
    const head = CONFIG.skeleton.head;

    const leftEar = this.visiblePoint(pose, "left_ear");
    const rightEar = this.visiblePoint(pose, "right_ear");
    const leftEye = this.visiblePoint(pose, "left_eye");
    const rightEye = this.visiblePoint(pose, "right_eye");
    const leftShoulder = this.visiblePoint(pose, "left_shoulder");
    const rightShoulder = this.visiblePoint(pose, "right_shoulder");

    const center = pose.headCenter();
    if (!center) return;

    const shoulderCenter =
      leftShoulder && rightShoulder
        ? this.midpoint(leftShoulder, rightShoulder)
        : null;

    const earDistance =
      leftEar && rightEar ? this.distance(leftEar, rightEar) : 0;
    const eyeDistance =
      leftEye && rightEye ? this.distance(leftEye, rightEye) : 0;
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

      p.stroke(this.withAlpha(p, colors.bone, alpha));
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
    p.stroke(this.withAlpha(p, colors.joint, alpha));
    p.strokeWeight(head.neckWeight);
    p.circle(projectedCenter.x, projectedCenter.y, projectedRadius * 2);
  }
}
