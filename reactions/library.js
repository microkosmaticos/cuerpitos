import { cryReaction } from "./cry.js";
import { heartReaction } from "./heart.js";
import { punchReaction } from "./punch.js";
import { smokeReaction } from "./smoke.js";

/**
 * Reaction library. Every entry is an independent module with its own
 * duration, start rule and rendering contribution. Add a reaction here and
 * the director can pick it; no other file needs to know about it.
 */
export const REACTION_LIBRARY = [
  punchReaction,
  heartReaction,
  cryReaction,
  smokeReaction,
];
