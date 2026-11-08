// ============================================================
// racimoLateral.js
//
// FAMILIA 3: Racimo lateral (del dibujo personaje3, el geométrico).
//
// Composición original: brazos y antebrazos vuelven al lugar donde
// los dibujaste. Las piezas extra se agregan en ángulos libres,
// separadas de las que ya están.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" es el ancho máximo de la silueta y "height" el
// alto máximo. No hay "radius": las piezas son rectángulos.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const LADOS = ["izquierda", "derecha"];

const BRAZOS = [0, 1, 2].map((indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: `forma-3/brazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice,
  ranges: {
    width: { min: 231, max: 481 },
    height: { min: 146, max: 304 },
  },
}));

const ANTEBRAZOS = [0, 1, 2].map((indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: `forma-3/antebrazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice + 3,
  ranges: {
    width: { min: 163, max: 338 },
    height: { min: 103, max: 215 },
  },
}));

const CONEXIONES = [
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

export const RACIMO_LATERAL = congelarProfundo({
  id: "racimo-lateral",
  name: "Racimo lateral",
  description: "Un torso geométrico con brazos y antebrazos en su posición original.",

  roles: {
    nucleo: { min: 1, max: 1 },
    brazo: { min: 2, max: 3 },
    antebrazo: { min: 2, max: 3 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "silueta",
      silhouette: "forma-3/torso",
      anchor: null,
      ranges: {
        width: { min: 323, max: 671 },
        height: { min: 377, max: 783 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
  ],

  connections: CONEXIONES,

  // Canónica: 3 brazos y 3 antebrazos (valor medio del rango 2–3).
  canonical: {
    parts: [
      { slotId: "nucleo", width: 497, height: 580 },
      { slotId: "brazo-1", width: 356, height: 225, angle: 210.5 },
      { slotId: "brazo-2", width: 356, height: 225, angle: 356.5 },
      { slotId: "brazo-3", width: 356, height: 225, angle: 90 },
      { slotId: "antebrazo-1", width: 250, height: 159, angle: 210.8 },
      { slotId: "antebrazo-2", width: 250, height: 159, angle: 329.2 },
      { slotId: "antebrazo-3", width: 250, height: 159, angle: 90 },
    ],
  },
});
