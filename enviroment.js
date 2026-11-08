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

   The waves layer is itself undulating: it is drawn as narrow vertical
   strips, each one slightly shifted vertically, so the original drawing
   flows like water (see the "Waves animation" section below). Nothing
   is re-drawn or reshaped: every strip samples the artwork itself.

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

/**
 * The base artwork has a ~1 px transparent border of its own: its SVG
 * clip path stops just before the artboard edge. Growing the layer a
 * little pushes that edge outside the viewport, so no fallback colour
 * is ever visible at the screen border.
 */
const BASE_BLEED = 0.01;

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

/**
 * Grows a rect around its own center by `bleed` (a fraction of its size).
 * Used to push a layer's transparent border outside the viewport.
 *
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {number} bleed
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function inflateRect(rect, bleed) {
  const padX = (rect.w * bleed) / 2;
  const padY = (rect.h * bleed) / 2;

  return {
    x: rect.x - padX,
    y: rect.y - padY,
    w: rect.w + padX * 2,
    h: rect.h + padY * 2,
  };
}

/* ------------------------------------------------------------------
   Waves animation
   ------------------------------------------------------------------
   The artwork is undulated slice by slice: the layer is drawn as a row
   of vertical strips, and each strip is shifted vertically by a smooth
   travelling wave built from two sines plus low-frequency Perlin noise.
   Every strip samples the original artwork, so the drawing itself is
   preserved - nothing is re-drawn, stretched or reshaped - it simply
   flows like water.

   The strips tile horizontally with integer bounds, so there are no
   seams; the only thing that changes between neighbours is the
   sub-pixel vertical offset, which is invisible.

   All magnitudes are fractions of the drawn layer, so the effect looks
   the same on any screen size.
   ------------------------------------------------------------------ */

/** Strip width in canvas pixels; the strip count adapts to the window width. */
const WAVES_STRIP_WIDTH = 8;

/** Safety limits for the adaptive strip count. */
const WAVES_MIN_STRIPS = 96;
const WAVES_MAX_STRIPS = 360;

/** Wave height, as a fraction of the layer height (~11 px on a 900 tall window). */
const WAVES_AMPLITUDE = 0.012;

/** Slow swell: the wave height breathes +/- 25% of itself. */
const WAVES_AMPLITUDE_SWING = 0.25;

/** Overscan around the layer: always greater than the maximum offset. */
const WAVES_BLEED = 0.04;

/** Periods in seconds: slow, and deliberately not multiples of each other. */
const WAVES_PRIMARY_PERIOD = 31;
const WAVES_SECONDARY_PERIOD = 47;
const WAVES_SWELL_PERIOD = 26;

/** Weights of the three wave components; they add up to 1. */
const WAVES_PRIMARY_WEIGHT = 0.55;
const WAVES_SECONDARY_WEIGHT = 0.3;
const WAVES_NOISE_WEIGHT = 0.15;

/**
 * Vertical offset of a strip, in pixels.
 *
 * `u` is the horizontal position across the layer (0 = left, 1 = right)
 * and `t` the elapsed time in seconds. Two travelling sines with
 * different speeds and wavelengths produce a wave that never visibly
 * repeats; the noise term adds an organic, non-mechanical wobble.
 *
 * @param {number} u
 * @param {number} t
 * @param {number} amplitude
 * @returns {number}
 */
function wavesVerticalOffset(u, t, amplitude) {
  const primary =
    Math.sin(u * Math.PI * 2 * 1.15 + (t / WAVES_PRIMARY_PERIOD) * Math.PI * 2) *
    WAVES_PRIMARY_WEIGHT;

  const secondary =
    Math.sin(u * Math.PI * 2 * 2.6 - (t / WAVES_SECONDARY_PERIOD) * Math.PI * 2 + 1.7) *
    WAVES_SECONDARY_WEIGHT;

  const organic = (noise(u * 2.2 + 7.5, t * 0.05) - 0.5) * 2 * WAVES_NOISE_WEIGHT;

  return (primary + secondary + organic) * amplitude;
}

/**
 * Draws the waves layer undulating over its original design.
 *
 * @param {p5.Image|null} layer
 * @param {{x: number, y: number, w: number, h: number}} cover
 */
function drawAnimatedWaves(layer, cover) {
  if (!layer) return;

  // seconds since the sketch started, so the animation is frame-rate
  // independent and always continuous (no state to reset or drift).
  const t = millis() / 1000;

  const swell = 1 + Math.sin((t / WAVES_SWELL_PERIOD) * Math.PI * 2) * WAVES_AMPLITUDE_SWING;
  const amplitude = cover.h * WAVES_AMPLITUDE * swell;

  // the layer is drawn slightly larger than the screen so that the
  // vertical offsets can never expose an edge at the window borders
  const area = inflateRect(cover, WAVES_BLEED);
  const left = area.x;
  const top = area.y;
  const width = area.w;
  const height = area.h;

  const strips = constrain(
    Math.round(width / WAVES_STRIP_WIDTH),
    WAVES_MIN_STRIPS,
    WAVES_MAX_STRIPS
  );
  const step = width / strips;

  for (let i = 0; i < strips; i++) {
    // integer bounds: adjacent strips share the exact same edge, so no seams
    const x0 = Math.round(left + i * step);
    const x1 = Math.round(left + (i + 1) * step);
    const stripWidth = x1 - x0;
    if (stripWidth <= 0) continue;

    const u = (x0 + stripWidth / 2 - left) / width;
    const offset = wavesVerticalOffset(u, t, amplitude);

    // sample the matching columns of the original artwork
    const sx = ((x0 - left) / width) * layer.width;
    const sw = (stripWidth / width) * layer.width;

    image(layer, x0, top + offset, stripWidth, height, sx, 0, sw, layer.height);
  }
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
  drawBackgroundLayer(backgroundLayers.base, inflateRect(rect, BASE_BLEED));
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
