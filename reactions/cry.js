import { CONFIG } from "../config.js";

/**
 * Cry reaction library.
 *
 * One participant loses control of its face and cries: small tears spawn at
 * the eyes, fall with gravity and shrink until they disappear. The tears are
 * a body reaction, so the figure that owns them draws them from its own eye
 * positions.
 *
 * The director owns the lifecycle; this module only picks the crier.
 */
export const cryReaction = {
  id: "cry",
  durationMs: CONFIG.figure.reactions.cry.durationMs,

  /** Pick the crier. Needs at least one visible eye to shed tears. */
  start(now, { participants, random }) {
    if (!participants || participants.length < 2) return null;

    const index = random() < 0.5 ? 0 : 1;
    const crier = participants[index];
    const { pose } = crier;
    if (!pose.isVisible("left_eye") && !pose.isVisible("right_eye")) {
      return null;
    }

    return {
      owner: crier,
      state: { startedAt: now },
    };
  },
};
