// ============================================================
// color.js
//
// Conversiones y cuentas de color, sin depender de p5.
//
// ¿QUÉ ES HSL?
//   H (hue / tono):      el color en una rueda de 0° a 360°.
//                        Ej: 0 es rojo, 120 verde, 240 azul.
//   S (saturation):      cuánto color tiene, de 0 % (gris) a 100 %.
//   L (lightness):       qué tan cerca está del negro (0 %) o del
//                        blanco (100 %). Con 50 % está el color puro.
//
// HSL nos deja mover SOLO la luminosidad y conservar el tono: así
// el rosa de tu dibujo sigue siendo rosa aunque lo aclaremos u
// oscurezcamos.
// ============================================================

/** Construye un color a partir de HSL. */
export function crearColor(h, s, l, a = 1) {
  const hh = Math.round(((h % 360) + 360) % 360);
  const ss = Math.round(acotar(s, 0, 100));
  const ll = Math.round(acotar(l, 0, 100));
  const alpha = Math.round(acotar(a, 0, 1) * 100) / 100;

  return {
    h: hh,
    s: ss,
    l: ll,
    a: alpha,
    // Formato que p5.js pasa directo al canvas.
    css: `hsla(${hh}, ${ss}%, ${ll}%, ${alpha})`,
  };
}

/** HSL → [r, g, b] con valores 0–255. */
export function hslARgb({ h, s, l }) {
  const tono = ((h % 360) + 360) % 360;
  const sat = acotar(s, 0, 100) / 100;
  const lum = acotar(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((tono / 60) % 2) - 1));
  const m = lum - c / 2;

  let rgb;
  if (tono < 60) rgb = [c, x, 0];
  else if (tono < 120) rgb = [x, c, 0];
  else if (tono < 180) rgb = [0, c, x];
  else if (tono < 240) rgb = [0, x, c];
  else if (tono < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((valor) => Math.round((valor + m) * 255));
}

/**
 * Luminancia relativa según WCAG 2.1 (0 = negro, 1 = blanco).
 * Es el "brillo real" que percibe el ojo, no el promedio de los canales.
 */
export function luminanciaRelativa([r, g, b]) {
  const canal = (valor) => {
    const v = valor / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste entre dos colores RGB (1 = iguales, 21 = blanco contra negro). */
export function contraste(colorA, colorB) {
  const a = luminanciaRelativa(colorA);
  const b = luminanciaRelativa(colorB);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);

  return (claro + 0.05) / (oscuro + 0.05);
}

/** Contraste de un color HSL contra un fondo RGB. */
export function contrasteConFondo(colorHsl, fondoRgb) {
  return contraste(hslARgb(colorHsl), fondoRgb);
}

export function acotar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}
