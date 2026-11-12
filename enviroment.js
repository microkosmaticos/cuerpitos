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

   The stars layer keeps every star exactly where the artwork puts it,
   and adds a soft, independent glow on each one, with its own rhythm.
   The big sparkles also breathe in size, each one on its own clock
   (see the "Stars animation" section below).

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
const WAVES_STRIP_WIDTH = 5;

/** Safety limits for the adaptive strip count. */
const WAVES_MIN_STRIPS = 160;
const WAVES_MAX_STRIPS = 460;

/** Wave height, as a fraction of the layer height (~27 px on a 900 tall window). */
const WAVES_AMPLITUDE = 0.03;

/** The wave height breathes down to this fraction of its maximum. */
const WAVES_AMPLITUDE_MIN = 0.7;

/** Overscan around the layer: always greater than the maximum offset. */
const WAVES_BLEED = 0.07;

/** Periods in seconds: slow, and deliberately not multiples of each other. */
const WAVES_PRIMARY_PERIOD = 10;
const WAVES_SECONDARY_PERIOD = 15;
const WAVES_SWELL_PERIOD = 23;

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

  // the wave height breathes between WAVES_AMPLITUDE_MIN and 100% of
  // the amplitude, so the layer never looks like it is being pushed
  // by a constant, mechanical force
  const breath = 0.5 + 0.5 * Math.sin((t / WAVES_SWELL_PERIOD) * Math.PI * 2);
  const swell = WAVES_AMPLITUDE_MIN + (1 - WAVES_AMPLITUDE_MIN) * breath;
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

/* ------------------------------------------------------------------
   Stars animation
   ------------------------------------------------------------------
   The stars are part of the artwork (fondo-estrellas.png), so their
   positions are never touched: the layer is drawn exactly where the
   cover fit puts it.

   To make each star shine on its own, the layer is analysed once at
   start-up: every blob of opaque pixels is detected, and its centroid
   and size are stored. Every frame, a soft additive glow is drawn on
   top of each detected star, with its own phase, speed and depth, so
   no two stars pulse together and some barely move at all.

   The big sparkles (the four pointed ones) additionally breathe in
   size: each one is cut out of the layer at start-up into its own small
   canvas. Every frame the layer is drawn with a hole where that sparkle
   was, and the cut-out is redrawn on top at a slightly smaller scale,
   so a single star can shrink without touching its neighbours.

   The original layer is drawn slightly dimmed (STARS_BASE_ALPHA) so the
   glow has room to brighten and fade instead of only brightening.
   ------------------------------------------------------------------ */

/** Opacity of the original stars layer; the glow adds the rest back. */
const STARS_BASE_ALPHA = 0.85;

/** How far the glow spreads, relative to the detected star radius. */
const STARS_GLOW_SPREAD = 4.6;

/** Minimum glow radius, in canvas pixels, so tiny dots still shine. */
const STARS_GLOW_MIN_RADIUS = 9;

/** Share of stars that stay almost static. */
const STARS_STATIC_SHARE = 0.3;

/** Twinkle periods, in seconds: slow enough to never look like blinking. */
const STARS_FASTEST_PERIOD = 3.2;
const STARS_SLOWEST_PERIOD = 9;

/** Maximum added brightness, as a fraction of a fully white glow. */
const STARS_GLOW_STRENGTH = 0.9;
const STARS_STATIC_STRENGTH = 0.15;

/** Alpha threshold used to tell a star from the transparent background. */
const STARS_ALPHA_THRESHOLD = 24;

/** Padding, in layer pixels, kept around a sparkle so its tips are never clipped. */
const STARS_HOLE_PAD = 2;

/** A star whose bounding box is at least this wide (fraction of the layer) is a sparkle. */
const STARS_SPARKLE_MIN_WIDTH = 0.02;

/** Smallest scale a sparkle reaches before returning to its normal size. */
const STARS_SPARKLE_MIN_SCALE = 0.88;

/** Small overlap so a redrawn sparkle never shows a one pixel seam. */
const STARS_SPARKLE_OVERLAP = 1.01;

/** Periods, in seconds, for the sparkle size breathing. */
const STARS_SPARKLE_FASTEST = 4;
const STARS_SPARKLE_SLOWEST = 7.5;

/**
 * Deterministic pseudo-random number in [0, 1) for a given seed.
 * The same star always gets the same rhythm, on every reload and on
 * every screen size.
 *
 * @param {number} seed
 * @returns {number}
 */
function starsRandom(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Finds every star in the layer: connected blobs of opaque pixels, with
 * their centroid, size and a personal twinkle rhythm.
 *
 * Positions are returned normalised to the layer (0 = left/top,
 * 1 = right/bottom), so they can be mapped onto any screen size.
 *
 * @param {p5.Image|null} layer
 * @returns {Array<object>}
 */
function starsDetect(layer) {
  if (!layer) return [];

  layer.loadPixels();

  const w = layer.width;
  const h = layer.height;
  const px = layer.pixels;
  const total = w * h;

  const visited = new Uint8Array(total);
  const stack = [];
  const found = [];

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    if (px[start * 4 + 3] < STARS_ALPHA_THRESHOLD) continue;

    stack.length = 0;
    stack.push(start);

    let sumAlpha = 0;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    let peak = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;

    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % w;
      const y = (index - x) / w;
      const alpha = px[index * 4 + 3];

      sumAlpha += alpha;
      sumX += x * alpha;
      sumY += y * alpha;
      count++;
      if (alpha > peak) peak = alpha;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && !visited[index - 1]) {
        visited[index - 1] = 1;
        if (px[(index - 1) * 4 + 3] >= STARS_ALPHA_THRESHOLD) stack.push(index - 1);
      }
      if (x < w - 1 && !visited[index + 1]) {
        visited[index + 1] = 1;
        if (px[(index + 1) * 4 + 3] >= STARS_ALPHA_THRESHOLD) stack.push(index + 1);
      }
      if (y > 0 && !visited[index - w]) {
        visited[index - w] = 1;
        if (px[(index - w) * 4 + 3] >= STARS_ALPHA_THRESHOLD) stack.push(index - w);
      }
      if (y < h - 1 && !visited[index + w]) {
        visited[index + w] = 1;
        if (px[(index + w) * 4 + 3] >= STARS_ALPHA_THRESHOLD) stack.push(index + w);
      }
    }

    // ignore stray anti-aliasing specks and anything too faint to be a star
    if (count < 8 || peak < 40 || sumAlpha === 0) continue;

    const seed = found.length + 1;
    const rare = starsRandom(seed * 3.7 + 1.3);
    const isQuiet = rare < STARS_STATIC_SHARE;

    // the padded bounding box, normalised; sparkles are drawn from their
    // own crop so they can be scaled without touching their neighbours
    const boxX0 = Math.max(0, minX - STARS_HOLE_PAD);
    const boxY0 = Math.max(0, minY - STARS_HOLE_PAD);
    const boxX1 = Math.min(w, maxX + 1 + STARS_HOLE_PAD);
    const boxY1 = Math.min(h, maxY + 1 + STARS_HOLE_PAD);
    const isSparkle = Math.max(boxX1 - boxX0, boxY1 - boxY0) >= w * STARS_SPARKLE_MIN_WIDTH;

    found.push({
      u: sumX / sumAlpha / w,
      v: sumY / sumAlpha / h,
      r: Math.sqrt(count / Math.PI) / w,
      x0: boxX0 / w,
      y0: boxY0 / h,
      x1: boxX1 / w,
      y1: boxY1 / h,
      sparkle: isSparkle,
      crop: null,
      cropW: 0,
      cropH: 0,
      strength: isQuiet
        ? STARS_STATIC_STRENGTH * (0.3 + 0.7 * starsRandom(seed * 5.1 + 2.9))
        : STARS_GLOW_STRENGTH * (0.45 + 0.55 * starsRandom(seed * 5.1 + 2.9)),
      phase: starsRandom(seed * 7.3 + 4.1) * Math.PI * 2,
      period:
        STARS_FASTEST_PERIOD +
        starsRandom(seed * 11.9 + 6.7) * (STARS_SLOWEST_PERIOD - STARS_FASTEST_PERIOD),
      // a second, slower rhythm only changes the glow size, it never
      // makes the star blink
      sizePhase: starsRandom(seed * 13.7 + 8.3) * Math.PI * 2,
      sizePeriod:
        STARS_SLOWEST_PERIOD +
        starsRandom(seed * 17.3 + 9.1) * STARS_SLOWEST_PERIOD,
      // sparkles also breathe in size, each one on its own rhythm
      scalePhase: starsRandom(seed * 19.1 + 10.9) * Math.PI * 2,
      scalePeriod:
        STARS_SPARKLE_FASTEST +
        starsRandom(seed * 23.3 + 12.7) * (STARS_SPARKLE_SLOWEST - STARS_SPARKLE_FASTEST),
    });
  }

  // stable order: left to right, so the twinkle pattern is reproducible
  found.sort((a, b) => a.u - b.u);

  return found;
}

/**
 * Pre-renders the soft glow sprite used by every star, so the drawing
 * loop only has to scale and blend one small texture.
 *
 * @returns {p5.Graphics}
 */
function starsCreateGlow() {
  const size = 128;
  const glow = createGraphics(size, size);

  glow.pixelDensity(1);

  const ctx = glow.drawingContext;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

  gradient.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  gradient.addColorStop(0.16, "rgba(236, 244, 255, 0.5)");
  gradient.addColorStop(0.42, "rgba(208, 226, 255, 0.16)");
  gradient.addColorStop(1, "rgba(190, 210, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  return glow;
}

/** Stars found in the layer, glow sprite and sparkle crops, filled at setup. */
const starsState = {
  list: [],
  sparkles: [],
  glow: null,
};

/**
 * Cuts every sparkle out of the stars layer into its own small canvas.
 *
 * That is what allows a single star to change size: the layer is drawn
 * with a hole where the sparkle used to be, and the crop is redrawn on
 * top, scaled. Neighbouring stars are never touched.
 *
 * @param {p5.Image|null} layer
 */
function starsCreateSparkleCrops(layer) {
  if (!layer) return;

  starsState.sparkles = [];

  for (const star of starsState.list) {
    if (!star.sparkle) continue;

    const sx = Math.round(star.x0 * layer.width);
    const sy = Math.round(star.y0 * layer.height);
    const sw = Math.min(
      Math.round((star.x1 - star.x0) * layer.width),
      layer.width - sx
    );
    const sh = Math.min(
      Math.round((star.y1 - star.y0) * layer.height),
      layer.height - sy
    );

    if (sw <= 0 || sh <= 0) continue;

    const crop = createGraphics(sw, sh);
    crop.pixelDensity(1);
    crop.drawingContext.drawImage(layer.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    star.crop = crop;
    star.cropW = sw;
    star.cropH = sh;
    starsState.sparkles.push(star);
  }
}

/**
 * Rect, in canvas pixels, covered by a star's bounding box.
 *
 * @param {object} star
 * @param {{x: number, y: number, w: number, h: number}} cover
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function starsBoxRect(star, cover) {
  return {
    x: cover.x + star.x0 * cover.w,
    y: cover.y + star.y0 * cover.h,
    w: (star.x1 - star.x0) * cover.w,
    h: (star.y1 - star.y0) * cover.h,
  };
}

/**
 * Current size of a sparkle: it shrinks gently and comes back to its
 * normal size, never above 1 (so it never covers its own hole edges).
 *
 * @param {object} star
 * @param {number} t elapsed time in seconds
 * @returns {number}
 */
function starsSparkleScale(star, t) {
  const pulse = 0.5 + 0.5 * Math.sin(star.scalePhase + (t / star.scalePeriod) * Math.PI * 2);
  return 1 - (1 - STARS_SPARKLE_MIN_SCALE) * pulse;
}

/**
 * Draws the stars layer plus one independent, additive glow per star.
 *
 * The original artwork keeps every star in its original place; the only
 * ones that change shape are the sparkles, which are redrawn from their
 * own crop at a gently breathing scale.
 *
 * @param {p5.Image|null} layer
 * @param {{x: number, y: number, w: number, h: number}} cover
 */
function drawAnimatedStars(layer, cover) {
  if (!layer) return;

  const t = millis() / 1000;
  const ctx = drawingContext;
  const sparkles = starsState.sparkles;

  // the original artwork, slightly dimmed so the glow can also fade
  ctx.save();

  if (sparkles.length > 0) {
    // cut the sparkles out of the layer: an even-odd path made of the
    // whole canvas plus one hole per sparkle
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    for (let i = 0; i < sparkles.length; i++) {
      const box = starsBoxRect(sparkles[i], cover);
      ctx.rect(box.x, box.y, box.w, box.h);
    }
    ctx.clip("evenodd");
  }

  ctx.globalAlpha = STARS_BASE_ALPHA;
  ctx.drawImage(layer.canvas, cover.x, cover.y, cover.w, cover.h);
  ctx.restore();

  // put each sparkle back, scaled around its own centre
  if (sparkles.length > 0) {
    ctx.save();
    ctx.globalAlpha = STARS_BASE_ALPHA;

    for (let i = 0; i < sparkles.length; i++) {
      const star = sparkles[i];
      if (!star.crop) continue;

      const box = starsBoxRect(star, cover);
      const size = starsSparkleScale(star, t) * STARS_SPARKLE_OVERLAP;
      const w = box.w * size;
      const h = box.h * size;

      ctx.drawImage(star.crop.canvas, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    }

    ctx.restore();
  }

  if (!starsState.glow || starsState.list.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < starsState.list.length; i++) {
    const star = starsState.list[i];

    const pulse = 0.5 + 0.5 * Math.sin(star.phase + (t / star.period) * Math.PI * 2);
    const alpha = star.strength * pulse * pulse * (3 - 2 * pulse);

    if (alpha < 0.004) continue;

    const breath =
      1 + 0.08 * Math.sin(star.sizePhase + (t / star.sizePeriod) * Math.PI * 2);

    // a sparkle's glow follows the size of its star, so both breathe together
    const scale = star.sparkle ? starsSparkleScale(star, t) : 1;

    const radius = Math.max(
      STARS_GLOW_MIN_RADIUS,
      star.r * cover.w * STARS_GLOW_SPREAD
    ) * breath * scale;

    const x = cover.x + star.u * cover.w;
    const y = cover.y + star.v * cover.h;

    ctx.globalAlpha = alpha;
    ctx.drawImage(starsState.glow.canvas, x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.restore();
}

/** Loads the three background artworks. */
function environmentPreload() {
  backgroundLayers.base = loadImage(BACKGROUND_ASSETS.base);
  backgroundLayers.waves = loadImage(BACKGROUND_ASSETS.waves);
  backgroundLayers.stars = loadImage(BACKGROUND_ASSETS.stars);
}

/** Creates the full-window canvas and analyses the stars layer once. */
function environmentSetup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CORNER);

  starsState.list = starsDetect(backgroundLayers.stars);
  starsCreateSparkleCrops(backgroundLayers.stars);
  starsState.glow = starsCreateGlow();
}

/** Paints the background composition for the current window size. */
function environmentDraw() {
  background(BACKGROUND_COLOR);

  const rect = backgroundCoverRect();
  drawBackgroundLayer(backgroundLayers.base, inflateRect(rect, BASE_BLEED));
  drawAnimatedWaves(backgroundLayers.waves, rect);
  drawAnimatedStars(backgroundLayers.stars, rect);
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
