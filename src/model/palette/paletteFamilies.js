// ============================================================
// paletteFamilies.js
//
// Las FAMILIAS DE PALETAS. Son solo datos, congelados: acá no se
// sortea nada. Cada familia nace de un dibujo de archivossvg/ y usa
// sus dos colores ancla como centro.
//
// En los cuatro dibujos el mapeo es el mismo:
//   - torso y antebrazos usan el tono "base"
//   - cabeza y brazos usan el tono "acento"
//
// "base" y "acento" son los colores EXACTOS del SVG. La única
// excepción es el vino (#aa002d), explicada en su familia.
// ============================================================

import { congelarProfundo } from "../families/deepFreeze.js";

export const PALETAS = congelarProfundo({
  // #ff9bcf / #f15aa9
  rosa: {
    id: "rosa",
    nombre: "Rosa",
    svg: "1persona",
    base: { h: 328.8, s: 100, l: 80.4 },
    acento: { h: 328.6, s: 84.4, l: 64.9 },
  },

  // #247ae9 / #a6e8f4
  azul: {
    id: "azul",
    nombre: "Azul",
    svg: "personaje 2",
    base: { h: 213.8, s: 81.7, l: 52.7 },
    acento: { h: 189.2, s: 78, l: 80.4 },
  },

  // #aa002d / #ff5570
  //
  // #aa002d es hsl(344°, 100%, 33%): demasiado oscuro para un cuerpo
  // luminoso. Se conserva el TONO y se sube la luminosidad del cuerpo
  // a 58% (#ff2962). El ancla original queda como borde/profundidad:
  // el rol "oscuro" derivado (L 34%) es prácticamente ese mismo color.
  vino: {
    id: "vino",
    nombre: "Vino",
    svg: "personaje3",
    base: { h: 344.1, s: 100, l: 58 },
    acento: { h: 350.5, s: 100, l: 66.7 },
  },

  // #54c9b7 / #8ce0ae
  turquesa: {
    id: "turquesa",
    nombre: "Turquesa",
    svg: "personaje 4",
    base: { h: 170.8, s: 52, l: 55.9 },
    acento: { h: 144.3, s: 57.5, l: 71.4 },
  },
});
