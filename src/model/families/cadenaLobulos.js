// ============================================================
// cadenaLobulos.js
//
// FAMILIA 2: Cadena de lóbulos.
//
// Masas encadenadas: cada lóbulo nace del borde del anterior.
// Solo datos, igual que la familia 1. Nada se sortea acá.
//
// Las direcciones son ABSOLUTAS: cada ángulo se mide alrededor del
// centro del padre, empezando por la derecha y avanzando en sentido
// horario (porque en pantalla la Y crece hacia abajo).
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

// La familia permite hasta 5 lóbulos: declaramos los 5 slots.
const LOBULOS = Array.from({ length: 5 }, (_, indice) => ({
  id: `lobulo-${indice + 1}`,
  role: "lobulo",
  baseShape: "lobulo",
  pivot: { x: 0, y: 0 },
  // Ancla abstracta propia de cada lóbulo.
  anchor: indice,
  // "size" es el RADIO del lóbulo (no el diámetro).
  ranges: {
    size: { min: 70, max: 160 },
  },
}));

// En cadena: el 1 se une al núcleo, el 2 al 1, el 3 al 2...
const CONEXIONES = LOBULOS.map((slot, indice) => ({
  child: slot.id,
  parent: indice === 0 ? "nucleo" : LOBULOS[indice - 1].id,
  at: "borde",
  angleRange: { min: -180, max: 180 },
}));

export const CADENA_LOBULOS = congelarProfundo({
  id: "cadena-lobulos",
  name: "Cadena de lóbulos",
  description: "Masas encadenadas, cada una más chica que la anterior.",

  roles: {
    nucleo: { min: 1, max: 1 },
    lobulo: { min: 2, max: 5 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "lobulo",
      pivot: { x: 0, y: 0 },
      anchor: null,
      // "size" es el RADIO del núcleo (no el diámetro).
      ranges: {
        size: { min: 130, max: 210 },
      },
    },
    ...LOBULOS,
  ],

  connections: CONEXIONES,

  // Canónica: 4 lóbulos (el medio del rango 2–5 es 3.5, redondeado a 4).
  // Los tamaños bajan en cadena y los ángulos suben en curva,
  // para que se vea como un cuerpo que se enrosca.
  // Recordá: cada "size" es un RADIO.
  canonical: {
    parts: [
      { slotId: "nucleo", size: 170 },
      { slotId: "lobulo-1", size: 150, angle: -85 },
      { slotId: "lobulo-2", size: 125, angle: -55 },
      { slotId: "lobulo-3", size: 100, angle: -25 },
      { slotId: "lobulo-4", size: 80, angle: 5 },
    ],
  },
});
