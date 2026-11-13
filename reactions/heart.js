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
  start(now, { participants, random }) {
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
    const travelled = config.float * state.base * progress;
    const spacing = (config.float * state.base) / (config.trail.count + 1);
    const visible = Math.min(
      config.trail.count,
      Math.floor(travelled / spacing)
    );
    const shapes = [];

    // Farthest trail heart first, so the nearest overlaps on top of it.
    for (let index = visible; index >= 1; index -= 1) {
      const distance = index * spacing;
      const sway =
        Math.sin(distance / (state.base * 0.35)) *
        config.trail.sway *
        state.base;

      shapes.push(
        heartProp(
          state.center.x + sway,
          state.center.y - distance,
          size *
            Math.max(
              0.12,
              config.trail.size - (index - 1) * config.trail.shrink
            )
        )
      );
    }

    shapes.push({
      ...heartProp(
        state.center.x,
        state.center.y - travelled,
        size
      ),
      main: true,
    });

    shapes.push({
      kind: "ellipse",
      x: state.center.x - size * 0.45,
      y: state.center.y - travelled - size * 0.42,
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

  if (progress < 0.86) {
    const t = (progress - 0.32) / 0.54;
    return 1.12 + 0.05 * Math.sin(t * Math.PI * 2);
  }

  const t = (progress - 0.86) / 0.14;
  return Math.max(0, 1.12 * (1 - t * t));
}

function heartProp(x, y, size) {
  return {
    kind: "heart",
    x,
    y,
    size,
    angle: 0,
    accent: true,
    reaction: "heart",
  };
}
