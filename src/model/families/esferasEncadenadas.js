// ============================================================
// esferasEncadenadas.js
//
// FAMILIA 1: Esferas encadenadas (del dibujo personaje 4, el de círculos).
//
// Anatomía: un núcleo grande, una cabeza redonda arriba y una cola de
// esferas que se van encadenando, cada una del tamaño de la anterior
// o más chica. La cabeza lleva los ojos del dibujo original.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
// El punto de giro de cada parte es su punto de unión (el origen),
// porque la silueta ya viene normalizada desde silhouettes.js.
//
// MEDIDAS: "radius" es RADIO, no diámetro.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

// Hasta 5 eslabones: se declaran los 5 slots para que los ids sean estables.
const ESLABONES = Array.from({ length: 5 }, (_, indice) => ({
  id: `eslabon-${indice + 1}`,
  role: "eslabon",
  baseShape: "esfera",
  // El ancla 0 es la cabeza; los eslabones siguen desde 1.
  anchor: indice + 1,
  ranges: {
    radius: { min: 47, max: 98 },
  },
}));

const CONEXIONES = ESLABONES.map((slot, indice) => ({
  child: slot.id,
  parent: indice === 0 ? "nucleo" : ESLABONES[indice - 1].id,
  at: "borde",
  angleRange: { min: 0, max: 360 },
}));

export const ESFERAS_ENCADENADAS = congelarProfundo({
  id: "esferas-encadenadas",
  name: "Esferas encadenadas",
  description: "Un núcleo redondo con una cola de esferas que se afina.",

  roles: {
    nucleo: { min: 1, max: 1 },
    cabeza: { min: 1, max: 1 },
    eslabon: { min: 2, max: 5 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "esfera",
      anchor: null,
      ranges: {
        radius: { min: 182, max: 379 },
      },
    },
    {
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-4/cabeza",
      anchor: 0,
      ranges: {
        width: { min: 241, max: 501 },
        height: { min: 241, max: 501 },
      },
    },
    ...ESLABONES,
  ],

  connections: [
    // La cabeza siempre arriba; los eslabones pueden salir para cualquier lado.
    { child: "cabeza", parent: "nucleo", at: "borde", angleRange: { min: -120, max: -60 } },
    ...CONEXIONES,
  ],

  // Canónica: 4 eslabones (el medio del rango 2–5 es 3.5, redondeado a 4).
  // Cada valor es el punto medio de su rango.
  canonical: {
    parts: [
      { slotId: "nucleo", radius: 280 },
      { slotId: "cabeza", width: 371, height: 371, angle: -90 },
      { slotId: "eslabon-1", radius: 73, angle: 90 },
      { slotId: "eslabon-2", radius: 73, angle: 100 },
      { slotId: "eslabon-3", radius: 73, angle: 110 },
      { slotId: "eslabon-4", radius: 73, angle: 120 },
    ],
  },
});
