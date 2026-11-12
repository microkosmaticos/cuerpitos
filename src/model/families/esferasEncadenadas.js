// ============================================================
// esferasEncadenadas.js
//
// FAMILIA 4: Esferas encadenadas (del dibujo personaje 4, el de círculos).
//
// Composición original: los círculos grandes vuelven a su lugar como
// brazos y los chicos como antebrazos. Las esferas extra se agregan
// en ángulos libres, como una cadena que se abre.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" y "height" son ancho y alto máximos de la silueta.
// Acá todas las piezas son círculos, así que las dos medidas van juntas.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const LADOS = ["izquierda", "derecha"];

const BRAZOS = [0, 1, 2].map((indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: `forma-4/brazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice,
  ranges: {
    width: { min: 140, max: 290 },
    height: { min: 140, max: 290 },
  },
}));

const ANTEBRAZOS = [0, 1, 2].map((indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: `forma-4/antebrazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice + 3,
  ranges: {
    width: { min: 94, max: 196 },
    height: { min: 94, max: 196 },
  },
}));

const CONEXIONES = [
  { child: "cabeza", parent: "nucleo", at: "borde", angleRange: { min: 0, max: 360 } },
  ...BRAZOS.map((slot) => ({
    child: slot.id,
    parent: "nucleo",
    at: "borde",
    angleRange: { min: 0, max: 360 },
  })),
  ...ANTEBRAZOS.map((slot, indice) => ({
    child: slot.id,
    parent: BRAZOS[indice].id,
    at: "borde",
    angleRange: { min: 0, max: 360 },
  })),
];

export const ESFERAS_ENCADENADAS = congelarProfundo({
  id: "esferas-encadenadas",
  name: "Esferas encadenadas",
  description: "Un núcleo redondo con círculos alrededor, como una cadena abierta.",

  roles: {
    nucleo: { min: 1, max: 1 },
    cabeza: { min: 1, max: 1 },
    brazo: { min: 2, max: 3 },
    antebrazo: { min: 2, max: 3 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "silueta",
      silhouette: "forma-4/torso",
      anchor: null,
      ranges: {
        width: { min: 365, max: 757 },
        height: { min: 365, max: 757 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
    {
      // La cabeza va rígida con el torso: no tiene ancla propia.
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-4/cabeza",
      origen: true,
      anchor: null,
      ranges: {
        width: { min: 241, max: 501 },
        height: { min: 241, max: 501 },
      },
    },
  ],

  connections: CONEXIONES,

  // Canónica: 3 brazos y 3 antebrazos (valor medio del rango 2–3).
  canonical: {
    parts: [
      { slotId: "nucleo", width: 561, height: 561 },
      { slotId: "brazo-1", width: 215, height: 215, angle: 196.9 },
      { slotId: "brazo-2", width: 215, height: 215, angle: 343.1 },
      { slotId: "brazo-3", width: 215, height: 215, angle: 90 },
      { slotId: "antebrazo-1", width: 145, height: 145, angle: 202.5 },
      { slotId: "antebrazo-2", width: 145, height: 145, angle: 337.5 },
      { slotId: "antebrazo-3", width: 145, height: 145, angle: 90 },

      { slotId: "cabeza", width: 371, height: 371, angle: 270 },
    ],
  },
});
