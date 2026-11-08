// ============================================================
// FamilyRegistry.js
//
// El registro de familias anatómicas. Es la única puerta de entrada
// al catálogo: nadie más importa los archivos de families/.
//
// Cuando estén las 4 familias, se agregan acá y listo.
// ============================================================

import { congelarProfundo } from "./families/deepFreeze.js";
import { BLOB_TENTACULOS } from "./families/blobTentaculos.js";
import { CADENA_LOBULOS } from "./families/cadenaLobulos.js";
import { ESTRELLA_IRREGULAR } from "./families/estrellaIrregular.js";
import { MASAS_ORGANICAS } from "./families/masasOrganicas.js";

const FAMILIAS = [BLOB_TENTACULOS, CADENA_LOBULOS, ESTRELLA_IRREGULAR, MASAS_ORGANICAS];

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
