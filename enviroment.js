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
  drawBackgroundLayer(backgroundLayers.waves, rect);
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
