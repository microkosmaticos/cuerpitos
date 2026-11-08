// ============================================================
// abanicoExtremidades.js
//
// FAMILIA 1: Abanico de extremidades (del dibujo 1persona).
//
// Composición original: el brazo izquierdo y el derecho vuelven al
// lugar donde los dibujaste, y cada antebrazo sale de la punta de su
// brazo. Las piezas extra (si el azar da más de dos) se agregan en
// ángulos libres, lejos de las que ya están.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" es el ancho máximo de la silueta y "height" el
// alto máximo. No hay "radius": ninguna parte es redonda.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const LADOS = ["izquierda", "derecha"];

const BRAZOS = [0, 1, 2, 3].map((indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: `forma-1/brazo-${LADOS[indice % 2]}`,
  // Los dos primeros son los del dibujo; los otros son extra.
  origen: indice < 2,
  anchor: indice,
  ranges: {
    width: { min: 170, max: 354 },
    height: { min: 128, max: 266 },
  },
}));

const ANTEBRAZOS = [0, 1, 2, 3].map((indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: `forma-1/antebrazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice + 4,
  ranges: {
    width: { min: 130, max: 270 },
    height: { min: 115, max: 239 },
  },
}));

// Cada antebrazo cuelga de su brazo, nunca del torso.
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

export const ABANICO_EXTREMIDADES = congelarProfundo({
  id: "abanico-extremidades",
  name: "Abanico de extremidades",
  description: "Un torso con brazos y antebrazos en su posición original.",

  roles: {
    nucleo: { min: 1, max: 1 },
    cabeza: { min: 1, max: 1 },
    brazo: { min: 2, max: 4 },
    antebrazo: { min: 2, max: 4 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "silueta",
      silhouette: "forma-1/torso",
      anchor: null,
      ranges: {
        width: { min: 305, max: 633 },
        height: { min: 389, max: 809 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
    {
      // La cabeza va rígida con el torso: no tiene ancla propia.
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-1/cabeza",
      origen: true,
      anchor: null,
      ranges: {
        width: { min: 493, max: 1023 },
        height: { min: 320, max: 666 },
      },
    },
  ],

  connections: CONEXIONES,

  // Canónica: 3 brazos y 3 antebrazos (valor medio del rango 2–4).
  // Los dos primeros van en su dirección original; el tercero, arriba.
  canonical: {
    parts: [
      { slotId: "nucleo", width: 469, height: 599 },
      { slotId: "brazo-1", width: 262, height: 197, angle: 180.9 },
      { slotId: "brazo-2", width: 262, height: 197, angle: 4.1 },
      { slotId: "brazo-3", width: 262, height: 197, angle: 90 },
      { slotId: "antebrazo-1", width: 200, height: 177, angle: 201.1 },
      { slotId: "antebrazo-2", width: 200, height: 177, angle: 340.7 },
      { slotId: "antebrazo-3", width: 200, height: 177, angle: 90 },

      { slotId: "cabeza", width: 758, height: 493, angle: 295.6 },
    ],
  },
});
