import { CONFIG } from "../config.js";

/**
 * Smoke reaction library.
 *
 * One participant gets angry: puffs of smoke rise from the top of its head.
 * It is a body reaction, so the figure that owns it draws the puffs from its
 * own head position and palette.
 *
 * The director owns the lifecycle; this module only picks the smoker.
 */
export const smokeReaction = {
  id: "smoke",
  durationMs: CONFIG.figure.reactions.smoke.durationMs,

  /** Pick the smoker. Needs a visible head to puff from. */
  start(now, { participants, random }) {
    if (!participants || participants.length < 2) return null;

    const index = random() < 0.5 ? 0 : 1;
    const smoker = participants[index];
    if (!smoker.pose.headCenter()) return null;

    return {
      owner: smoker,
      state: { startedAt: now },
    };
  },
};
