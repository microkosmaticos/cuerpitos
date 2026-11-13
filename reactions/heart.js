import { CONFIG } from "../config.js";
import { chestOf, midpoint } from "./geometry.js";

/**
 * Heart reaction library.
 *
 * A big balloon heart pops up between both chests, inflates, floats up and
 * leaves a trail of smaller hearts. It is a scene prop, not a body part, so it
 * is drawn outside the figure scaling.
 *
 * The director owns the lifecycle; this module only builds and samples the
 * prop at a given time.
 */
export const heartReaction = {
  id: "heart",
  durationMs: CONFIG.figure.reactions.heart.durationMs,

  /** Pick the palette owner and freeze the midpoint between both chests. */
  start(now, { participants, random, scene }) {
    if (!participants || participants.length < 2) return null;

    const drawerIndex = random() < 0.5 ? 0 : 1;
    const drawer = participants[drawerIndex];
    const other = participants[1 - drawerIndex];
    const mine = chestOf(drawer.pose);
    const theirs = chestOf(other.pose);
    if (!mine || !theirs) return null;

    return {
      drawer,
      state: {
        startedAt: now,
        base:
          (Math.max(1, drawer.pose.scale || 1) +
            Math.max(1, other.pose.scale || 1)) /
          2,
        center: midpoint(mine, theirs),
        // The visible top of the page, in video coordinates. The heart flies
        // all the way there and disappears at the edge.
        top: scene?.top ?? 0,
        palette: drawer.figure?.proportions?.palette ?? null,
      },
    };
  },

  /** The main heart, its trail and its balloon highlight at `now`. */
  propsAt(now, state) {
    const config = CONFIG.figure.reactions.heart;
    const progress = (now - state.startedAt) / config.durationMs;
    if (!(progress >= 0) || progress >= 1) return [];

    const size = config.size * state.base * heartScale(progress);
    // Negative: the page top is above the chests.
    const dy = state.top - state.center.y;
    const shapes = particlesAt(now, state, dy);

    shapes.push({
      ...heartProp(
        state.center.x,
        state.center.y + dy * progress,
        size
      ),
      main: true,
    });

    shapes.push({
      kind: "ellipse",
      x: state.center.x - size * 0.45,
      y: state.center.y + dy * progress - size * 0.42,
      rx: size * 0.2,
      ry: size * 0.11,
      angle: -0.6,
      fill: state.palette?.bone ?? "#ffffff",
      reaction: "heart",
    });

    return shapes;
  },
};

/**
 * Heart size over the reaction: an elastic balloon inflation that settles
 * fatter than the base size, a gentle breathing while it flies, then a shrink
 * so it disappears without needing alpha.
 */
function heartScale(progress) {
  if (progress < 0.18) {
    const t = progress / 0.18;
    return 1.35 * (1 - (1 - t) ** 3);
  }

  if (progress < 0.32) {
    const t = (progress - 0.18) / 0.14;
    return 1.35 + (1.12 - 1.35) * t;
  }

  if (progress < 0.9) {
    const t = (progress - 0.32) / 0.58;
    return 1.12 + 0.05 * Math.sin(t * Math.PI * 2);
  }

  const t = (progress - 0.9) / 0.1;
  return Math.max(0, 1.12 * (1 - t * t));
}

function heartProp(x, y, size, extra = {}) {
  return {
    kind: "heart",
    x,
    y,
    size,
    angle: 0,
    accent: true,
    reaction: "heart",
    ...extra,
  };
}

/**
 * Particle trail. Every `spawnMs` a small heart is born where the main heart
 * was at that moment. Each particle lives `lifeMs`, drifts sideways, sinks a
 * little, spins and shrinks until it disappears. Everything is derived from
 * the clock, so the system is stateless and deterministic.
 */
function particlesAt(now, state, dy) {
  const config = CONFIG.figure.reactions.heart;
  const trail = config.trail;
  const elapsed = now - state.startedAt;
  const first = Math.max(
    0,
    Math.ceil((elapsed - trail.lifeMs) / trail.spawnMs)
  );
  const last = Math.floor(elapsed / trail.spawnMs);
  const particles = [];

  for (let index = first; index <= last; index += 1) {
    if (particles.length >= trail.max) break;

    const age = elapsed - index * trail.spawnMs;
    if (age < 0 || age >= trail.lifeMs) continue;

    const spawnProgress = (index * trail.spawnMs) / config.durationMs;
    if (spawnProgress > trail.maxProgress) continue;

    const fade = 1 - age / trail.lifeMs;
    const spawnMainSize =
      config.size * state.base * heartScale(spawnProgress);
    const spawnSize = spawnMainSize * trail.size;
    // While the main heart is still inflating, skip invisible particles.
    if (spawnSize < config.size * state.base * 0.01) continue;

    const offset = (variation(index, 1) - 0.5) * trail.spread * state.base;
    const sink = trail.sink * state.base * (age / trail.lifeMs);

    particles.push(
      heartProp(
        state.center.x + offset,
        state.center.y +
          dy * spawnProgress +
          spawnMainSize * trail.behind +
          sink,
        spawnSize * fade,
        {
          angle:
            (variation(index, 2) - 0.5) * 0.8 +
            (age / trail.lifeMs) * trail.spin,
        }
      )
    );
  }

  return particles;
}

/** Deterministic 0..1 noise so particles vary without storing state. */
function variation(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
