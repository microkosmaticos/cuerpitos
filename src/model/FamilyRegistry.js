// ============================================================
// FamilyRegistry.js
//
// El registro de familias anatómicas. Es la única puerta de entrada
// al catálogo: nadie más importa los archivos de families/.
//
// Cuando estén las 4 familias, se agregan acá y listo.
// ============================================================

import { congelarProfundo } from "./families/deepFreeze.js";
import { ESFERAS_ENCADENADAS } from "./families/esferasEncadenadas.js";
import { ABANICO_EXTREMIDADES } from "./families/abanicoExtremidades.js";
import { SERPIENTE_ALTERNADA } from "./families/serpienteAlternada.js";
import { RACIMO_LATERAL } from "./families/racimoLateral.js";

const FAMILIAS = [
  ESFERAS_ENCADENADAS,
  ABANICO_EXTREMIDADES,
  SERPIENTE_ALTERNADA,
  RACIMO_LATERAL,
];

export const FamilyRegistry = congelarProfundo({
  /** Todas las familias registradas, en orden. */
  listFamilies() {
    return FAMILIAS;
  },

  /** Busca una familia por id o por nombre. Devuelve undefined si no existe. */
  getFamily(nombreOId) {
    return FAMILIAS.find((familia) => familia.id === nombreOId || familia.name === nombreOId);
  },

  /** true si la familia existe. */
  hasFamily(nombreOId) {
    return Boolean(this.getFamily(nombreOId));
  },
});
