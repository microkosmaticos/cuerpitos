import { CONFIG } from "./config.js";

export const ParticipantState = Object.freeze({
  EMPTY: "EMPTY",
  ACTIVE: "ACTIVE",
  LOST: "LOST",
  ABSENT: "ABSENT",
});

export const SessionState = Object.freeze({
  SELECTING: "SELECTING",
  PARTIAL: "PARTIAL",
  LOCKED: "LOCKED",
});

/**
 * Participant selection and lock.
 *
 * Pure logic: no p5, no ml5, no DOM. It receives `Pose` instances in real
 * video coordinates and decides which two people belong to the experience.
 *
 * Two identity levels:
 *  - trackId: MoveNet's ephemeral tracker id (can change on occlusion).
 *  - participantId / slotId: our stable identity for organisms and events.
 */
export class ParticipantTracker {
  constructor(config = CONFIG.participants) {
    this.config = config;
    this.frameWidth = 0;
    this.frameHeight = 0;
    this.nextParticipantId = 0;
    this.nextCandidateId = 0;
    this.slots = [this.createSlot(0), this.createSlot(1)];
    this.candidates = [];
  }

  setFrameSize(width, height) {
    this.frameWidth = width;
    this.frameHeight = height;
  }

  reset() {
    this.slots = [this.createSlot(0), this.createSlot(1)];
    this.candidates = [];
  }

  createSlot(slotId) {
    return {
      slotId,
      state: ParticipantState.EMPTY,
      participantId: null,
      trackId: null,
      pose: null,
      center: null,
      velocity: { x: 0, y: 0 },
      scale: 0,
      box: null,
      firstSeenAt: null,
      lastSeenAt: null,
      lostSince: null,
    };
  }

  createCandidate(pose, now) {
    return {
      candidateId: (this.nextCandidateId += 1),
      trackId: pose.trackId,
      pose,
      center: { ...pose.center },
      velocity: { x: 0, y: 0 },
      scale: pose.scale,
      box: pose.box,
      firstSeenAt: now,
      lastSeenAt: now,
    };
  }

  update(poses, now) {
    const list = Array.isArray(poses) ? poses.filter(Boolean) : [];
    const takenSlots = this.slots.filter(
      (slot) => slot.participantId != null
    );

    const slotCosts = takenSlots.map((slot) =>
      list.map((pose) => this.matchCost(slot, pose, now))
    );
    const slotAssignment = this.assignOptimal(
      takenSlots.map((slot) => this.maxCostFor(slot)),
      slotCosts
    );

    const usedPoses = new Set();
    takenSlots.forEach((slot, index) => {
      const poseIndex = slotAssignment[index];
      if (poseIndex >= 0) {
        usedPoses.add(poseIndex);
        this.updateRecord(slot, list[poseIndex], now);
      } else {
        this.markMissing(slot, now);
      }
    });

    this.releaseIfNeeded(now);

    const unmatched = list.filter((_, index) => !usedPoses.has(index));
    this.updateCandidates(unmatched, now);
    this.lockStableCandidates(now);
    this.pruneCandidates(now);

    const participants = this.slots
      .filter((slot) => slot.participantId != null)
      .map((slot) => this.toParticipant(slot));

    const participantPoses = new Set(
      participants.map((participant) => participant.pose)
    );
    const ignored = list.filter((pose) => !participantPoses.has(pose));

    return {
      participants,
      ignored,
      session: this.sessionState(),
    };
  }

  // ---------------------------------------------------------------- matching

  /**
   * Geometric compatibility between a stored record and an incoming pose.
   * Returns null when the hard gates fail, otherwise a 0..1 cost.
   */
  geometryCost(record, pose, now) {
    if (!pose || !pose.center || !record.center) return null;

    const dt =
      record.lastSeenAt == null
        ? 0
        : Math.max(0, now - record.lastSeenAt) / 1000;
    const predicted = {
      x: record.center.x + record.velocity.x * dt,
      y: record.center.y + record.velocity.y * dt,
    };

    const scale = Math.max(record.scale, pose.scale, 1);
    const distance = Math.hypot(
      pose.center.x - predicted.x,
      pose.center.y - predicted.y
    );
    const normDistance = distance / scale;
    const scaleRatio = Math.abs(pose.scale - record.scale) / scale;

    const predictedBox = shiftBox(
      record.box,
      record.velocity.x * dt,
      record.velocity.y * dt
    );
    const iou = intersectionOverUnion(predictedBox, pose.box);

    const { maxCenterDistanceNorm, maxScaleRatio } = this.config.matching;
    if (normDistance > maxCenterDistanceNorm) return null;
    if (scaleRatio > maxScaleRatio) return null;

    return (
      0.55 * Math.min(normDistance / maxCenterDistanceNorm, 1) +
      0.25 * (1 - iou) +
      0.2 * Math.min(scaleRatio / maxScaleRatio, 1)
    );
  }

  matchCost(record, pose, now) {
    const geometric = this.geometryCost(record, pose, now);
    if (geometric == null) return Infinity;

    // The same MoveNet track id is the strongest signal, but only when the
    // geometry gates above already passed (protects against id swaps).
    if (record.trackId != null && pose.trackId === record.trackId) {
      return 0.05;
    }
    return geometric;
  }

  maxCostFor(slot) {
    return slot.state === ParticipantState.ABSENT
      ? this.config.matching.absentMaxCost
      : this.config.matching.maxCost;
  }

  /**
   * Brute-force optimal assignment. At most two slots, so enumerating every
   * combination is trivial and avoids greedy swap errors when people cross.
   */
  assignOptimal(maxCosts, costs) {
    const slotCount = maxCosts.length;
    const poseCount = costs[0]?.length ?? 0;
    let best = new Array(slotCount).fill(-1);
    let bestTotal = Infinity;

    const walk = (slotIndex, used, current, total) => {
      if (slotIndex === slotCount) {
        if (total < bestTotal) {
          bestTotal = total;
          best = [...current];
        }
        return;
      }

      // Leave this slot unmatched.
      walk(
        slotIndex + 1,
        used,
        [...current, -1],
        total + maxCosts[slotIndex]
      );

      for (let poseIndex = 0; poseIndex < poseCount; poseIndex += 1) {
        if (used.has(poseIndex)) continue;
        const cost = costs[slotIndex][poseIndex];
        if (!Number.isFinite(cost) || cost > maxCosts[slotIndex]) continue;

        used.add(poseIndex);
        walk(slotIndex + 1, used, [...current, poseIndex], total + cost);
        used.delete(poseIndex);
      }
    };

    walk(0, new Set(), [], 0);
    return best;
  }

  updateRecord(record, pose, now) {
    const previousSeenAt = record.lastSeenAt;
    const dt =
      previousSeenAt == null ? 0 : Math.max(1, now - previousSeenAt) / 1000;

    if (record.center && dt > 0) {
      const maxSpeed =
        this.config.matching.maxVelocityNorm * Math.max(pose.scale, 1);
      const vx = clamp(
        (pose.center.x - record.center.x) / dt,
        -maxSpeed,
        maxSpeed
      );
      const vy = clamp(
        (pose.center.y - record.center.y) / dt,
        -maxSpeed,
        maxSpeed
      );
      const smoothing = this.config.matching.velocitySmoothing;
      record.velocity = {
        x: record.velocity.x * (1 - smoothing) + vx * smoothing,
        y: record.velocity.y * (1 - smoothing) + vy * smoothing,
      };
    }

    // Slots have a state; candidate records do not.
    if (record.slotId !== undefined) {
      record.state = ParticipantState.ACTIVE;
      record.lostSince = null;
    }

    record.pose = pose;
    record.trackId = pose.trackId;
    record.center = { ...pose.center };
    record.scale = pose.scale || record.scale;
    record.box = pose.box;
    record.lastSeenAt = now;

    if (record.firstSeenAt == null) record.firstSeenAt = now;
  }

  markMissing(slot, now) {
    if (slot.state === ParticipantState.ACTIVE) {
      slot.state = ParticipantState.LOST;
      slot.lostSince = now;
    } else if (slot.state === ParticipantState.LOST) {
      if (now - slot.lostSince >= this.config.lostGraceMs) {
        slot.state = ParticipantState.ABSENT;
      }
    }

    const decay = this.config.matching.velocityDecay;
    slot.velocity = {
      x: slot.velocity.x * decay,
      y: slot.velocity.y * decay,
    };
  }

  // ---------------------------------------------------------------- release

  releaseIfNeeded(now) {
    const taken = this.slots.filter((slot) => slot.participantId != null);
    if (taken.length === 0) return;

    const bothTaken = taken.length === 2;
    if (
      bothTaken &&
      taken.every(
        (slot) => now - slot.lastSeenAt >= this.config.releaseBothMs
      )
    ) {
      this.slots.forEach((slot) =>
        Object.assign(slot, this.createSlot(slot.slotId))
      );
      this.candidates = [];
      return;
    }

    const singleMs = this.config.singleSlotReleaseMs;
    if (singleMs != null && bothTaken) {
      taken.forEach((slot) => {
        const other = taken.find((candidate) => candidate !== slot);
        if (
          now - slot.lastSeenAt >= singleMs &&
          now - other.lastSeenAt < singleMs
        ) {
          Object.assign(slot, this.createSlot(slot.slotId));
        }
      });
    }
  }

  // ------------------------------------------------------------- candidates

  updateCandidates(poses, now) {
    this.pruneCandidates(now);

    const costs = this.candidates.map((candidate) =>
      poses.map((pose) => this.matchCost(candidate, pose, now))
    );
    const assignment = this.assignOptimal(
      this.candidates.map(() => this.config.matching.maxCost),
      costs
    );

    const usedPoses = new Set();
    this.candidates.forEach((candidate, index) => {
      const poseIndex = assignment[index];
      if (poseIndex >= 0) {
        usedPoses.add(poseIndex);
        this.updateRecord(candidate, poses[poseIndex], now);
      }
    });

    const remaining = poses.filter((_, index) => !usedPoses.has(index));
    for (const pose of remaining) {
      if (this.candidates.length >= this.config.maxCandidates) break;
      if (!this.isEligible(pose)) continue;
      this.candidates.push(this.createCandidate(pose, now));
    }

    this.pruneCandidates(now);
  }

  isEligible(pose) {
    if (!pose || !pose.hasTorso() || !pose.center) return false;
    if (pose.score < this.config.minPoseScore) return false;
    return this.inZone(pose.center);
  }

  inZone(center) {
    if (!this.frameWidth || !this.frameHeight) return true;

    const x = center.x / this.frameWidth;
    const y = center.y / this.frameHeight;
    const { zone } = this.config;
    return (
      x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax
    );
  }

  lockStableCandidates(now) {
    const emptySlots = this.slots.filter(
      (slot) => slot.state === ParticipantState.EMPTY
    );
    if (emptySlots.length === 0) return;

    const ready = this.candidates
      .filter(
        (candidate) =>
          candidate.lastSeenAt === now &&
          now - candidate.firstSeenAt >= this.config.acquireMs
      )
      .map((candidate) => ({
        candidate,
        score: this.candidateScore(candidate, now),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, emptySlots.length);

    // Left-to-right keeps slot colours stable when two people arrive together.
    ready.sort(
      (a, b) =>
        a.candidate.center.x - b.candidate.center.x || b.score - a.score
    );

    ready.forEach(({ candidate }) => {
      const slot = this.slots.find(
        (item) => item.state === ParticipantState.EMPTY
      );
      if (!slot) return;

      this.lockCandidate(slot, candidate, now);
      this.candidates = this.candidates.filter(
        (item) => item !== candidate
      );
    });
  }

  candidateScore(candidate, now) {
    const weights = this.config.weights;
    const centrality = this.centralityScore(candidate.center);
    const stability = Math.min(
      1,
      (now - candidate.firstSeenAt) / this.config.acquireMs
    );
    const size = this.sizeScore(candidate.scale);
    const confidence = clamp(candidate.pose.score ?? 0, 0, 1);

    return (
      weights.centrality * centrality +
      weights.stability * stability +
      weights.size * size +
      weights.confidence * confidence
    );
  }

  centralityScore(center) {
    if (!this.frameWidth || !this.frameHeight) return 0.5;

    const x = center.x / this.frameWidth - 0.5;
    const y = center.y / this.frameHeight - 0.5;
    const distance = Math.hypot(x, y) / 0.5;
    return 1 - clamp(distance, 0, 1);
  }

  sizeScore(scale) {
    if (!this.frameWidth) return 0.5;

    const ratio = scale / this.frameWidth;
    const { sizeMinRatio, sizeMaxRatio } = this.config;
    return clamp(
      (ratio - sizeMinRatio) / (sizeMaxRatio - sizeMinRatio),
      0,
      1
    );
  }

  lockCandidate(slot, candidate, now) {
    this.nextParticipantId += 1;

    slot.state = ParticipantState.ACTIVE;
    slot.participantId = `p${this.nextParticipantId}`;
    slot.trackId = candidate.trackId;
    slot.pose = candidate.pose;
    slot.center = { ...candidate.center };
    slot.velocity = { ...candidate.velocity };
    slot.scale = candidate.scale;
    slot.box = candidate.box;
    slot.firstSeenAt = candidate.firstSeenAt;
    slot.lastSeenAt = now;
    slot.lostSince = null;
  }

  pruneCandidates(now) {
    const memory = this.config.candidateMemoryMs;
    this.candidates = this.candidates.filter(
      (candidate) => now - candidate.lastSeenAt <= memory
    );
  }

  // ---------------------------------------------------------------- output

  sessionState() {
    const count = this.slots.filter(
      (slot) => slot.participantId != null
    ).length;
    if (count === 0) return SessionState.SELECTING;
    if (count === 1) return SessionState.PARTIAL;
    return SessionState.LOCKED;
  }

  toParticipant(slot) {
    return {
      slotId: slot.slotId,
      participantId: slot.participantId,
      state: slot.state,
      trackId: slot.trackId,
      pose: slot.pose,
      center: slot.center,
      velocity: slot.velocity,
      scale: slot.scale,
      box: slot.box,
      lastSeenAt: slot.lastSeenAt,
      lostSince: slot.lostSince,
    };
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shiftBox(box, dx, dy) {
  if (!box) return null;
  return {
    xMin: box.xMin + dx,
    yMin: box.yMin + dy,
    xMax: box.xMax + dx,
    yMax: box.yMax + dy,
  };
}

function intersectionOverUnion(a, b) {
  if (!a || !b) return 0;

  const xMin = Math.max(a.xMin, b.xMin);
  const yMin = Math.max(a.yMin, b.yMin);
  const xMax = Math.min(a.xMax, b.xMax);
  const yMax = Math.min(a.yMax, b.yMax);

  const intersection =
    Math.max(0, xMax - xMin) * Math.max(0, yMax - yMin);
  const areaA =
    Math.max(0, a.xMax - a.xMin) * Math.max(0, a.yMax - a.yMin);
  const areaB =
    Math.max(0, b.xMax - b.xMin) * Math.max(0, b.yMax - b.yMin);
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}
