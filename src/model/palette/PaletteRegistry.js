// ============================================================
// PaletteRegistry.js
//
// La puerta de entrada a las paletas. Nadie más importa
// paletteFamilies.js directamente.
//
// Acá vive también el vínculo entre familia anatómica y familia de
// paleta: cada organismo hereda los colores del dibujo del que salió
// su cuerpo. Mientras falten paletas, todas caen en "rosa".
// ============================================================

import { congelarProfundo } from "../families/deepFreeze.js";
import { PALETAS } from "./paletteFamilies.js";

// Qué paleta le toca a cada familia anatómica: cada organismo hereda
// los colores del dibujo del que salió su cuerpo.
const PALETA_POR_FAMILIA = {
  "abanico-extremidades": "rosa",
  "serpiente-alternada": "azul",
  "racimo-lateral": "vino",
  "esferas-encadenadas": "turquesa",
};

export const PaletteRegistry = congelarProfundo({
  /** Todas las paletas declaradas. */
  listPalettes() {
    return Object.values(PALETAS);
  },

  /** Busca una paleta por id. Devuelve undefined si no existe. */
  getPalette(id) {
    return PALETAS[id];
  },

  /** La paleta que le corresponde a una familia anatómica. */
  paletaParaFamilia(familiaAnatomicaId) {
    const id = PALETA_POR_FAMILIA[familiaAnatomicaId];

    if (!id) {
      throw new Error(
        `La familia anatómica "${familiaAnatomicaId}" no tiene paleta asignada en PaletteRegistry.`
      );
    }

    return PALETAS[id];
  },
});
