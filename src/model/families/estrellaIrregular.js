// ============================================================
// estrellaIrregular.js
//
// FAMILIA 3: Estrella irregular.
//
// Un núcleo chico con puntas afiladas de largos distintos.
// Las puntas se declaran con sus rangos; los valores concretos
// viven en la canónica. Nada se sortea.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

// Hasta 8 puntas: declaramos los 8 slots.
const PUNTAS = Array.from({ length: 8 }, (_, indice) => ({
  id: `punta-${indice + 1}`,
  role: "punta",
  baseShape: "punta",
  pivot: { x: 0, y: 0 },
  anchor: indice,
  // "length" es la distancia de la base a la punta y "thickness" es
  // el ancho en la base. Las dos en píxeles locales.
  ranges: {
    length: { min: 80, max: 240 },
    thickness: { min: 26, max: 70 },
  },
}));

const CONEXIONES = PUNTAS.map((slot) => ({
  child: slot.id,
  parent: "nucleo",
  at: "borde",
  angleRange: { min: 0, max: 360 },
}));

export const ESTRELLA_IRREGULAR = congelarProfundo({
  id: "estrella-irregular",
  name: "Estrella irregular",
  description: "Un núcleo con puntas desiguales que salen en todas direcciones.",

  roles: {
    nucleo: { min: 1, max: 1 },
    punta: { min: 3, max: 8 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "blob",
      pivot: { x: 0, y: 0 },
      anchor: null,
      // "size" es el RADIO del núcleo (no el diámetro).
      ranges: {
        size: { min: 60, max: 110 },
      },
    },
    ...PUNTAS,
  ],

  connections: CONEXIONES,

  // Canónica: 6 puntas (el medio del rango 3–8 es 5.5, redondeado a 6).
  // Los largos son bien distintos y los ángulos no están repartidos
  // parejo: así se lee irregular y no como una estrella geométrica.
  // Las puntas son finas y casi rectas, al revés que los tentáculos
  // del Blob, que son gruesos y muy curvados.
  canonical: {
    parts: [
      { slotId: "nucleo", size: 70 },
      { slotId: "punta-1", angle: 5, length: 230, thickness: 34, curva: 18 },
      { slotId: "punta-2", angle: 48, length: 190, thickness: 30, curva: -22 },
      { slotId: "punta-3", angle: 112, length: 240, thickness: 38, curva: 12 },
      { slotId: "punta-4", angle: 170, length: 175, thickness: 28, curva: -20 },
      { slotId: "punta-5", angle: 232, length: 220, thickness: 34, curva: 25 },
      { slotId: "punta-6", angle: 292, length: 205, thickness: 32, curva: -15 },
    ],
  },
});
