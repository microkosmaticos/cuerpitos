// ============================================================
// masasOrganicas.js
//
// FAMILIA 4: Masas orgánicas.
//
// Derivada de los SVG de archivossvg/: una masa central grande con
// masas satélite a los costados, como el torso con sus brazos.
// Sin cabeza y sin ojos: acá solo hay masas.
//
// Es una interpretación generativa, no una copia: no usa los paths
// del SVG, solo su idea de cuerpos hechos de masas blandas.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

// Hasta 4 masas satélite: declaramos los 4 slots.
const MASAS = Array.from({ length: 4 }, (_, indice) => ({
  id: `masa-${indice + 1}`,
  role: "masa",
  baseShape: "masa",
  pivot: { x: 0, y: 0 },
  anchor: indice,
  // "size" es el RADIO de la masa (no el diámetro).
  ranges: {
    size: { min: 90, max: 200 },
  },
}));

// Las masas van a AMBOS lados del núcleo, por eso el rango de
// dirección es completo. La idea de "sobre la horizontal" se aplica
// al elegir los ángulos de la canónica, no como límite del plano.
const CONEXIONES = MASAS.map((slot) => ({
  child: slot.id,
  parent: "nucleo",
  at: "borde",
  angleRange: { min: -180, max: 180 },
}));

export const MASAS_ORGANICAS = congelarProfundo({
  id: "masas-organicas",
  name: "Masas orgánicas",
  description: "Una masa central grande con satélites a los costados.",

  roles: {
    nucleo: { min: 1, max: 1 },
    masa: { min: 2, max: 4 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "masa",
      pivot: { x: 0, y: 0 },
      anchor: null,
      // "size" es el RADIO del núcleo (no el diámetro).
      ranges: {
        size: { min: 180, max: 300 },
      },
    },
    ...MASAS,
  ],

  connections: CONEXIONES,

  // Canónica: 3 masas (el medio del rango 2–4 es 3, exacto).
  // A propósito NO hay pares espejados: una masa grande a la izquierda,
  // una mediana arriba a la izquierda que se toca con la grande, y una
  // chica arriba a la derecha. Así no se lee como torso con dos brazos.
  // Los ángulos están dentro del rango declarado (-180 a 180):
  // -125 es lo mismo que 235, y -60 lo mismo que 300.
  canonical: {
    parts: [
      { slotId: "nucleo", size: 240 },
      { slotId: "masa-1", size: 195, angle: 165 },
      { slotId: "masa-2", size: 130, angle: -125 },
      { slotId: "masa-3", size: 110, angle: -60 },
    ],
  },
});
