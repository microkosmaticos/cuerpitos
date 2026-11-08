// ============================================================
// racimoLateral.js
//
// FAMILIA 4: Racimo lateral (del dibujo personaje3, el geométrico).
//
// Anatomía: un torso con todas las piezas amontonadas hacia UN MISMO
// lado. No hay simetría: es un racimo que crece torcido.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" es el ancho máximo de la silueta y "height" el alto
// máximo. No hay "radius": las piezas son rectángulos alargados.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const SATELITES = Array.from({ length: 6 }, (_, indice) => ({
  id: `satelite-${indice + 1}`,
  role: "satelite",
  baseShape: "silueta",
  silhouette: "forma-3/antebrazo",
  anchor: indice + 1,
  ranges: {
    width: { min: 163, max: 338 },
    height: { min: 103, max: 215 },
  },
}));

// Todas las piezas salen del núcleo, pero solo hacia un costado:
// entre -40° y 90° (a la derecha y abajo). Arriba queda la cabeza,
// y el hueco entre -60 y -40 evita que se le peguen.
const CONEXIONES = SATELITES.map((slot) => ({
  child: slot.id,
  parent: "nucleo",
  at: "borde",
  angleRange: { min: -40, max: 90 },
}));

export const RACIMO_LATERAL = congelarProfundo({
  id: "racimo-lateral",
  name: "Racimo lateral",
  description: "Un torso con todas las piezas amontonadas de un solo lado.",

  roles: {
    nucleo: { min: 1, max: 1 },
    cabeza: { min: 1, max: 1 },
    satelite: { min: 3, max: 6 },
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
    {
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-3/cabeza",
      anchor: 0,
      ranges: {
        width: { min: 397, max: 824 },
        height: { min: 445, max: 925 },
      },
    },
    ...SATELITES,
  ],

  connections: [
    { child: "cabeza", parent: "nucleo", at: "borde", angleRange: { min: -120, max: -60 } },
    ...CONEXIONES,
  ],

  // Canónica: 5 satélites (el medio del rango 3–6 es 4.5, redondeado a 5).
  // Repartidos dentro del costado permitido, con 30° entre cada uno.
  canonical: {
    parts: [
      { slotId: "nucleo", width: 497, height: 580 },
      { slotId: "cabeza", width: 610, height: 685, angle: -90 },
      { slotId: "satelite-1", width: 250, height: 159, angle: -35 },
      { slotId: "satelite-2", width: 250, height: 159, angle: -5 },
      { slotId: "satelite-3", width: 250, height: 159, angle: 25 },
      { slotId: "satelite-4", width: 250, height: 159, angle: 55 },
      { slotId: "satelite-5", width: 250, height: 159, angle: 85 },
    ],
  },
});
