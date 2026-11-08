// ============================================================
// serpienteAlternada.js
//
// FAMILIA 3: Serpiente alternada (del dibujo personaje 2).
//
// Anatomía: un solo cuerpo largo. Del torso sale un brazo, del brazo
// un antebrazo, del antebrazo otro brazo... los dos tipos de pieza
// se alternan formando una cadena.
//
// Es SOLO DATOS: no dibuja ni calcula puntos.
//
// MEDIDAS: "width" es el ancho máximo de la silueta y "height" el alto
// máximo. No hay "radius": ninguna parte de esta familia es redonda.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

const BRAZOS = Array.from({ length: 3 }, (_, indice) => ({
  id: `brazo-${indice + 1}`,
  role: "brazo",
  baseShape: "silueta",
  silhouette: "forma-2/brazo",
  anchor: indice + 1,
  ranges: {
    width: { min: 242, max: 504 },
    height: { min: 114, max: 238 },
  },
}));

const ANTEBRAZOS = Array.from({ length: 3 }, (_, indice) => ({
  id: `antebrazo-${indice + 1}`,
  role: "antebrazo",
  baseShape: "silueta",
  silhouette: "forma-2/antebrazo",
  anchor: indice + 4,
  ranges: {
    width: { min: 189, max: 393 },
    height: { min: 89, max: 185 },
  },
}));

// Cadena alternada: brazo → antebrazo → brazo → antebrazo...
// El orden importa: cada pieza necesita que su padre exista antes.
const CONEXIONES = [
  { child: "brazo-1", parent: "nucleo", at: "borde", angleRange: { min: 0, max: 360 } },
  { child: "antebrazo-1", parent: "brazo-1", at: "borde", angleRange: { min: 0, max: 360 } },
  { child: "brazo-2", parent: "antebrazo-1", at: "borde", angleRange: { min: 0, max: 360 } },
  { child: "antebrazo-2", parent: "brazo-2", at: "borde", angleRange: { min: 0, max: 360 } },
  { child: "brazo-3", parent: "antebrazo-2", at: "borde", angleRange: { min: 0, max: 360 } },
  { child: "antebrazo-3", parent: "brazo-3", at: "borde", angleRange: { min: 0, max: 360 } },
];

export const SERPIENTE_ALTERNADA = congelarProfundo({
  id: "serpiente-alternada",
  name: "Serpiente alternada",
  description: "Brazos y antebrazos encadenados formando un cuerpo largo.",

  roles: {
    nucleo: { min: 1, max: 1 },
    cabeza: { min: 1, max: 1 },
    brazo: { min: 1, max: 3 },
    antebrazo: { min: 1, max: 3 },
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
    {
      id: "cabeza",
      role: "cabeza",
      baseShape: "silueta",
      silhouette: "forma-2/cabeza",
      anchor: 0,
      ranges: {
        width: { min: 528, max: 1096 },
        height: { min: 365, max: 757 },
      },
    },
    ...BRAZOS,
    ...ANTEBRAZOS,
  ],

  connections: [
    { child: "cabeza", parent: "nucleo", at: "borde", angleRange: { min: -120, max: -60 } },
    ...CONEXIONES,
  ],

  // Canónica: 2 brazos y 2 antebrazos (valor medio del rango 1–3).
  // Los ángulos hacen que la cadena se enrolle.
  canonical: {
    parts: [
      { slotId: "nucleo", width: 692, height: 566 },
      { slotId: "cabeza", width: 812, height: 561, angle: -90 },
      { slotId: "brazo-1", width: 373, height: 176, angle: 20 },
      { slotId: "antebrazo-1", width: 291, height: 137, angle: 70 },
      { slotId: "brazo-2", width: 280, height: 176, angle: 30 },
      { slotId: "antebrazo-2", width: 260, height: 137, angle: 80 },
    ],
  },
});
