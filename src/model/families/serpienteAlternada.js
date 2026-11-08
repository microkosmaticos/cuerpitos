// ============================================================
// serpienteAlternada.js
//
// FAMILIA 2: Serpiente alternada (del dibujo personaje 2).
//
// Composición original: los brazos vuelven a su lugar del dibujo y
// cada antebrazo continúa desde la punta de su brazo. Con la pieza
// extra, el cuerpo gana una extremidad más.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" es el ancho máximo de la silueta y "height" el
// alto máximo. No hay "radius".
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const LADOS = ["izquierda", "derecha"];

const BRAZOS = [0, 1, 2].map((indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: `forma-2/brazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice,
  ranges: {
    width: { min: 242, max: 504 },
    height: { min: 114, max: 238 },
  },
}));

const ANTEBRAZOS = [0, 1, 2].map((indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: `forma-2/antebrazo-${LADOS[indice % 2]}`,
  origen: indice < 2,
  anchor: indice + 3,
  ranges: {
    width: { min: 189, max: 393 },
    height: { min: 89, max: 185 },
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

export const SERPIENTE_ALTERNADA = congelarProfundo({
  id: "serpiente-alternada",
  name: "Serpiente alternada",
  description: "Un cuerpo alargado con brazos y antebrazos encadenados.",

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
      silhouette: "forma-2/torso",
      anchor: null,
      ranges: {
        width: { min: 450, max: 934 },
        height: { min: 368, max: 764 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
  ],

  connections: CONEXIONES,

  // Canónica: 3 brazos y 3 antebrazos (valor medio del rango 2–3).
  canonical: {
    parts: [
      { slotId: "nucleo", width: 692, height: 566 },
      { slotId: "brazo-1", width: 373, height: 176, angle: 186.4 },
      { slotId: "brazo-2", width: 373, height: 176, angle: 352.7 },
      { slotId: "brazo-3", width: 373, height: 176, angle: 90 },
      { slotId: "antebrazo-1", width: 291, height: 137, angle: 186.4 },
      { slotId: "antebrazo-2", width: 291, height: 137, angle: 353.6 },
      { slotId: "antebrazo-3", width: 291, height: 137, angle: 90 },
    ],
  },
});
