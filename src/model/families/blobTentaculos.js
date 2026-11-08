// ============================================================
// blobTentaculos.js
//
// FAMILIA 1: Blob con tentáculos.
//
// Este archivo es SOLO DATOS. No dibuja nada y no calcula puntos:
// describe qué partes tiene la familia, cuántas puede tener, qué
// tamaños se permiten y cómo se conectan.
//
// Es un plano, no un organismo. Todavía no se sortea ningún valor:
// los rangos se DECLARAN y la canónica (la muestra fija de abajo)
// usa los valores medios.
// ============================================================

import { congelarProfundo } from "./deepFreeze.js";

// La familia permite hasta 7 apéndices, así que declaramos los 7 slots
// con id propio. El rango del rol dice cuántos se usan en cada organismo.
const APENDICES = Array.from({ length: 7 }, (_, indice) => ({
  id: `apendice-${indice + 1}`,
  role: "apendice",
  baseShape: "apendice",
  // El punto de giro está en la base del apéndice (0, 0).
  pivot: { x: 0, y: 0 },
  // Ancla abstracta: más adelante cualquier apéndice podrá seguir
  // cualquier punto del tracking, sin nombres humanos.
  anchor: indice,
  // Medidas: "length" es la distancia de la base a la punta y
  // "thickness" es el ancho en la base. Las dos en píxeles locales.
  ranges: {
    length: { min: 90, max: 230 },
    thickness: { min: 18, max: 46 },
  },
}));

// Cada apéndice cuelga del borde del núcleo, en cualquier dirección.
const CONEXIONES = APENDICES.map((slot) => ({
  child: slot.id,
  parent: "nucleo",
  at: "borde",
  angleRange: { min: 0, max: 360 },
}));

export const BLOB_TENTACULOS = congelarProfundo({
  id: "blob-tentaculos",
  name: "Blob con tentáculos",
  description: "Un núcleo blando con apéndices largos y curvos.",

  // Cuántas partes de cada rol puede tener un organismo de esta familia.
  // Solo se declara: no se sortea nada acá.
  roles: {
    nucleo: { min: 1, max: 1 },
    apendice: { min: 2, max: 7 },
  },

  slots: [
    {
      id: "nucleo",
      role: "nucleo",
      baseShape: "blob",
      pivot: { x: 0, y: 0 },
      // El núcleo no es una parte móvil: no lleva ancla.
      anchor: null,
      // "size" es el RADIO del núcleo (no el diámetro).
      ranges: {
        size: { min: 170, max: 260 },
      },
    },
    ...APENDICES,
  ],

  connections: CONEXIONES,

  // Canónica: 5 apéndices, el valor medio del rango 2–7 (4.5) redondeado.
  // Los largos y grosores varían dentro de los rangos y los ángulos no
  // están repartidos parejo: así se lee como un cuerpo con brazos
  // irregulares y no como una estrella.
  // Los ángulos están dentro del rango declarado (0 a 360):
  // 190 es lo mismo que -170, 265 lo mismo que -95 y 345 lo mismo que -15.
  canonical: {
    parts: [
      // El núcleo va primero: las demás partes se cuelgan de él.
      { slotId: "nucleo", size: 250 },
      { slotId: "apendice-1", angle: 190, length: 190, thickness: 42, curva: 55 },
      { slotId: "apendice-2", angle: 265, length: 205, thickness: 38, curva: -50 },
      { slotId: "apendice-3", angle: 345, length: 175, thickness: 44, curva: 60 },
      { slotId: "apendice-4", angle: 55, length: 160, thickness: 36, curva: -55 },
      { slotId: "apendice-5", angle: 130, length: 185, thickness: 40, curva: 40 },
    ],
  },
});
