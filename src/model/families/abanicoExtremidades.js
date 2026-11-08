// ============================================================
// abanicoExtremidades.js
//
// FAMILIA 2: Abanico de extremidades (del dibujo 1persona).
//
// Anatomía: un torso ancho, la cabeza arriba y muchas piezas sueltas
// colgando directamente del torso, en cualquier dirección. No hay
// segundo nivel: todo cuelga del núcleo.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: en una silueta, "width" es el ancho máximo y "height" el
// alto máximo. Acá no se usa "radius" porque ninguna parte es redonda.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const BRAZOS = Array.from({ length: 4 }, (_, indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: "forma-1/brazo",
  anchor: indice + 1,
  ranges: {
    width: { min: 170, max: 354 },
    height: { min: 128, max: 266 },
  },
}));

const ANTEBRAZOS = Array.from({ length: 4 }, (_, indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: "forma-1/antebrazo",
  anchor: indice + 5,
  ranges: {
    width: { min: 130, max: 270 },
    height: { min: 115, max: 239 },
  },
}));

// Todas las extremidades cuelgan del núcleo, sin nivel intermedio.
const CONEXIONES = [...BRAZOS, ...ANTEBRAZOS].map((slot) => ({
  child: slot.id,
  parent: "nucleo",
  at: "borde",
  angleRange: { min: 0, max: 360 },
}));

export const ABANICO_EXTREMIDADES = congelarProfundo({
  id: "abanico-extremidades",
  name: "Abanico de extremidades",
  description: "Un torso ancho con piezas sueltas saliendo en todas direcciones.",

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
    {
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-1/cabeza",
      anchor: 0,
      ranges: {
        width: { min: 493, max: 1023 },
        height: { min: 320, max: 666 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
  ],

  connections: [
    { child: "cabeza", parent: "nucleo", at: "borde", angleRange: { min: -120, max: -60 } },
    ...CONEXIONES,
  ],

  // Canónica: 3 brazos y 3 antebrazos (valor medio del rango 2–4).
  // Los ángulos dejan libre la zona de arriba, que es donde va la cabeza.
  canonical: {
    parts: [
      { slotId: "nucleo", width: 469, height: 599 },
      { slotId: "cabeza", width: 758, height: 493, angle: -90 },
      { slotId: "brazo-1", width: 262, height: 197, angle: 340 },
      { slotId: "brazo-2", width: 262, height: 197, angle: 60 },
      { slotId: "brazo-3", width: 262, height: 197, angle: 140 },
      { slotId: "antebrazo-1", width: 200, height: 177, angle: 20 },
      { slotId: "antebrazo-2", width: 200, height: 177, angle: 100 },
      { slotId: "antebrazo-3", width: 200, height: 177, angle: 180 },
    ],
  },
});
