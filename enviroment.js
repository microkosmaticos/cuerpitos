/* ------------------------------------------------------------------
   Environment background (p5.js)
   ------------------------------------------------------------------
   Composes the three background artworks into a single full-viewport
   scene, in this fixed stacking order:

     1. fondo-cuerpitos-01.svg  -> base layer (covers the whole screen)
     2. fondo-ondas.png         -> waves, above the base layer
     3. fondo-estrellas.png     -> stars, top layer

   All three assets are drawn on the same 2880 x 1800 artboard, so a
   single "cover" transform (scale up until it covers the window, then
   center it) is applied to every layer. That guarantees:

     - the background always fills 100% of the width and height,
     - no margins, white gaps or empty borders appear,
     - the original artwork proportion is preserved (no stretching),
     - every layer stays pixel-aligned with the others.

   Parts of the artwork that fall outside the window are simply clipped
   by the canvas, which is the expected behaviour for a "cover" fit.

   The waves layer has a very slow, continuous animation so the scene
   feels alive without stealing attention: it drifts a few pixels and
   "breathes" (a 0.3% uniform scale change). It never tilts, stretches
   or changes shape, and the motion is built from two incommensurate
   sine periods plus low-frequency Perlin noise, so it never repeats
   visibly and never jumps.

   Lifecycle: this module owns p5's preload/setup/draw/windowResized
   hooks while it is the only sketch on the page. If another module
   later owns the lifecycle, call environmentPreload(),
   environmentSetup(), environmentDraw() and environmentResized() from
   that module instead of keeping the hooks at the bottom of this file.
   ------------------------------------------------------------------ */

/** Width of the shared artboard, in pixels. */
const ART_WIDTH = 2880;

/** Height of the shared artboard, in pixels. */
const ART_HEIGHT = 1800;

/** Base colour of the artwork, painted while the images are loading. */
const BACKGROUND_COLOR = "#966ba9";

/** Relative paths to the background layers, from index.html. */
const BACKGROUND_ASSETS = {
  base: "fondo-cuerpitos-01.svg",
  waves: "fondo-ondas.png",
  stars: "fondo-estrellas.png",
};

/** Loaded p5.Image instances, one per layer. */
const backgroundLayers = {
  base: null,
  waves: null,
  stars: null,
};

/**
 * Rectangle, in canvas pixels, where the whole artboard is drawn so
 * that it covers the window without ever leaving a gap.
 *
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function backgroundCoverRect() {
  const scale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);
  const w = ART_WIDTH * scale;
  const h = ART_HEIGHT * scale;

  return {
    x: (width - w) / 2,
    y: (height - h) / 2,
    w,
    h,
  };
}

/**
 * Draws one layer over the shared artboard rectangle. A layer that is
 * still loading (or failed to load) is skipped, so the scene keeps
 * working with whatever is available.
 *
 * @param {p5.Image|null} layer
 * @param {{x: number, y: number, w: number, h: number}} rect
 */
function drawBackgroundLayer(layer, rect) {
  if (!layer) return;
  image(layer, rect.x, rect.y, rect.w, rect.h);
}

/* ------------------------------------------------------------------
   Waves animation
   ------------------------------------------------------------------
   All the values are fractions of the drawn rect, so the movement
   feels identical on any screen size.

   The waves rect is inflated by WAVES_BLEED so that the drift and the
   breathing can never expose a gap at the window borders. The bleed is
   larger than the maximum displacement, which keeps the composition
   visually identical to the original artwork.
   ------------------------------------------------------------------ */

/** Maximum drift, as a fraction of the drawn layer size. */
const WAVES_DRIFT = 0.0035;

/** Uniform scale variation (0.3%), the "breathing". */
const WAVES_BREATH = 0.003;

/** Overscan that absorbs drift + breathing without exposing edges. */
const WAVES_BLEED = 0.02;

/** Periods in seconds: slow, and deliberately not multiples of each other. */
const WAVES_DRIFT_PERIOD_X = 2 * Math.PI / 0.13; // ~48 s
const WAVES_DRIFT_PERIOD_Y = 2 * Math.PI / 0.107; // ~59 s
const WAVES_BREATH_PERIOD = 2 * Math.PI / 0.09; // ~70 s

/**
 * Draws the waves layer with its slow floating/breathing motion.
 *
 * Two sines with different periods give a long, non-repeating orbit;
 * low-frequency Perlin noise breaks the mechanical feel of a pure sine.
 * Both contributions are normalised to a maximum of 1, so the total
 * displacement never exceeds WAVES_DRIFT.
 *
 * @param {p5.Image|null} layer
 * @param {{x: number, y: number, w: number, h: number}} cover
 */
function drawAnimatedWaves(layer, cover) {
  if (!layer) return;

  // seconds since the sketch started, so the animation is frame-rate
  // independent and always continuous (no state to reset or drift).
  const t = millis() / 1000;

  const noiseX = noise(t * 0.05) * 2 - 1;
  const noiseY = noise(t * 0.05 + 97.3) * 2 - 1;

  const offsetX =
    (Math.sin((t / WAVES_DRIFT_PERIOD_X) * 2 * Math.PI) * 0.55 + noiseX * 0.45) *
    (cover.w * WAVES_DRIFT);

  const offsetY =
    (Math.cos((t / WAVES_DRIFT_PERIOD_Y) * 2 * Math.PI) * 0.55 + noiseY * 0.45) *
    (cover.h * WAVES_DRIFT);

  const breath = 1 + Math.sin((t / WAVES_BREATH_PERIOD) * 2 * Math.PI) * WAVES_BREATH;

  const w = cover.w * (1 + WAVES_BLEED) * breath;
  const h = cover.h * (1 + WAVES_BLEED) * breath;

  const centerX = cover.x + cover.w / 2 + offsetX;
  const centerY = cover.y + cover.h / 2 + offsetY;

  image(layer, centerX - w / 2, centerY - h / 2, w, h);
}

/** Loads the three background artworks. */
function environmentPreload() {
  backgroundLayers.base = loadImage(BACKGROUND_ASSETS.base);
  backgroundLayers.waves = loadImage(BACKGROUND_ASSETS.waves);
  backgroundLayers.stars = loadImage(BACKGROUND_ASSETS.stars);
}

/** Creates the full-window canvas. */
function environmentSetup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CORNER);
}

/** Paints the background composition for the current window size. */
function environmentDraw() {
  background(BACKGROUND_COLOR);

  const rect = backgroundCoverRect();
  drawBackgroundLayer(backgroundLayers.base, rect);
  drawAnimatedWaves(backgroundLayers.waves, rect);
  drawBackgroundLayer(backgroundLayers.stars, rect);
}

/** Keeps the canvas and the composition in sync with the window. */
function environmentResized() {
  resizeCanvas(windowWidth, windowHeight);
}

/* ------------------------------------------------------------------
   Standalone p5 lifecycle
   ------------------------------------------------------------------ */

function preload() {
  environmentPreload();
}

function setup() {
  environmentSetup();
}

function draw() {
  environmentDraw();
}

function windowResized() {
  environmentResized();
}
