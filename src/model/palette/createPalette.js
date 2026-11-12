// ============================================================
// createPalette.js
//
// Genera la paleta de un organismo al nacer.
//
// Dos ideas centrales:
//
// 1. TIENE SU PROPIO GENERADOR. La semilla de la paleta se deriva de
//    la del organismo con una constante fija. Así, cambiar la lógica
//    de las paletas NUNCA cambia la anatomía de una semilla conocida.
//
// 2. LA VARIACIÓN ES CHICA. Solo se mueve el tono ±8°, la saturación
//    ±5 puntos y la luminosidad ±3 puntos alrededor del ancla. Dos
//    organismos de la misma familia no son idénticos, pero se
//    reconoce el dibujo.
//
// Los cinco roles:
//   base   → cuerpo (núcleo, antebrazos, eslabones, satélites)
//   acento → cabeza y brazos
//   claro  → centro luminoso del degradado
//   oscuro → borde y profundidad
//   halo   → resplandor con transparencia
// ============================================================

import { SeededRandom } from "../random/SeededRandom.js";
import { congelarProfundo } from "../families/deepFreeze.js";
import { PaletteRegistry } from "./PaletteRegistry.js";
import { acotar, contrasteConFondo, crearColor } from "./color.js";

// Constante fija para derivar la semilla de la paleta.
const CONSTANTE_DE_PALETA = 0x9e3779b9;

/** Fondos de prueba: los mismos que usa la vista. */
export const FONDOS_DE_PRUEBA = congelarProfundo([
  { nombre: "oscuro", rgb: [11, 11, 18] },
  { nombre: "medio", rgb: [122, 122, 133] },
  { nombre: "claro", rgb: [230, 230, 234] },
]);

/**
 * Contraste mínimo exigido a la paleta.
 *
 * No se le pide a un solo color: se le pide a la TRÍADA que realmente
 * se dibuja (claro, base, oscuro). Un color luminoso no puede tener
 * 2.5:1 contra blanco y contra negro a la vez; en cambio la tríada
 * siempre tiene un extremo que contrasta con cada fondo.
 */
export const CONTRASTE_MINIMO = 2.5;

/** Cuánto se puede mover cada magnitud respecto del ancla. */
const VARIACION = congelarProfundo({ hue: 8, sat: 5, lum: 3 });

/** Límites duros de cada rol (números concretos, documentados). */
const LIMITES = congelarProfundo({
  base: { sMin: 45, sMax: 100, lMin: 52, lMax: 82 },
  acento: { sMin: 45, sMax: 100, lMin: 52, lMax: 82 },
  claro: { sMin: 60, sMax: 95, lMin: 84, lMax: 94 },
  oscuro: { sMin: 40, sMax: 90, lMin: 26, lMax: 36 },
  halo: { sMin: 40, sMax: 95, lMin: 72, lMax: 82, aMin: 0.18, aMax: 0.3 },
});

/** Punto de partida de los roles derivados. */
const DERIVACION = congelarProfundo({ claroL: 88, oscuroL: 34, haloL: 78, haloA: 0.25 });

/** Qué rol de paleta le toca a cada rol anatómico. */
export const COLOR_POR_ROL_ANATOMICO = congelarProfundo({
  nucleo: "base",
  antebrazo: "base",
  eslabon: "base",
  satelite: "base",
  cabeza: "acento",
  brazo: "acento",
});

/**
 * @param {string} familiaAnatomicaId id de la familia del cuerpo
 * @param {number|string} seed semilla del organismo
 */
export function createPalette(familiaAnatomicaId, seed) {
  const familia = PaletteRegistry.paletaParaFamilia(familiaAnatomicaId);

  // Generador propio: la anatomía no se entera de la paleta.
  const rng = new SeededRandom((Number(seed) ^ CONSTANTE_DE_PALETA) >>> 0);

  const base = sortearAncla(rng, familia.base, LIMITES.base);
  const acento = sortearAncla(rng, familia.acento, LIMITES.acento);

  // Derivados: mismo tono, distinta luminosidad.
  let claroL = DERIVACION.claroL;
  let oscuroL = DERIVACION.oscuroL;

  let colores = armarColores(base, acento, claroL, oscuroL);

  // Corrección determinista si algún fondo no llega al contraste mínimo.
  // Primero se oscurece el borde, después se aclara el centro.
  for (let paso = 0; paso < 6 && !cumpleContraste(colores); paso++) {
    oscuroL = acotar(oscuroL - 2, LIMITES.oscuro.lMin, LIMITES.oscuro.lMax);
    colores = armarColores(base, acento, claroL, oscuroL);
  }

  for (let paso = 0; paso < 6 && !cumpleContraste(colores); paso++) {
    claroL = acotar(claroL + 2, LIMITES.claro.lMin, LIMITES.claro.lMax);
    colores = armarColores(base, acento, claroL, oscuroL);
  }

  return congelarProfundo({
    familyId: familia.id,
    nombre: familia.nombre,
    seed: Number(seed),
    colors: colores,
  });
}

// ------------------------------------------------------------
// Ayudas
// ------------------------------------------------------------

/** Sortea un ancla dentro de la variación permitida y sus límites. */
function sortearAncla(rng, ancla, limites) {
  return crearColor(
    ancla.h + rng.range(-VARIACION.hue, VARIACION.hue),
    acotar(ancla.s + rng.range(-VARIACION.sat, VARIACION.sat), limites.sMin, limites.sMax),
    acotar(ancla.l + rng.range(-VARIACION.lum, VARIACION.lum), limites.lMin, limites.lMax)
  );
}

function armarColores(base, acento, claroL, oscuroL) {
  return {
    base,
    acento,
    claro: crearColor(
      base.h,
      acotar(base.s + 5, LIMITES.claro.sMin, LIMITES.claro.sMax),
      acotar(claroL, LIMITES.claro.lMin, LIMITES.claro.lMax)
    ),
    oscuro: crearColor(
      base.h,
      acotar(base.s * 0.9, LIMITES.oscuro.sMin, LIMITES.oscuro.sMax),
      acotar(oscuroL, LIMITES.oscuro.lMin, LIMITES.oscuro.lMax)
    ),
    halo: crearColor(
      acento.h,
      acotar(acento.s, LIMITES.halo.sMin, LIMITES.halo.sMax),
      acotar(DERIVACION.haloL + rngHalo(acento), LIMITES.halo.lMin, LIMITES.halo.lMax),
      DERIVACION.haloA
    ),
  };
}

// El halo acompaña apenas al acento, sin sortear nada nuevo.
function rngHalo(acento) {
  return (acento.l - 65) * 0.1;
}

/** ¿La tríada claro/base/oscuro llega al mínimo en los tres fondos? */
function cumpleContraste(colores) {
  return FONDOS_DE_PRUEBA.every((fondo) => {
    const mejor = Math.max(
      contrasteConFondo(colores.claro, fondo.rgb),
      contrasteConFondo(colores.base, fondo.rgb),
      contrasteConFondo(colores.oscuro, fondo.rgb)
    );
    return mejor >= CONTRASTE_MINIMO;
  });
}

/** Riesgo: el halo no se evalúa en contraste porque es un resplandor. */
export function colorDeRol(palette, rolAnatomico) {
  const rol = COLOR_POR_ROL_ANATOMICO[rolAnatomico] ?? "base";
  return palette.colors[rol];
}
