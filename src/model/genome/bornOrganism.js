// ============================================================
// bornOrganism.js
//
// Hace nacer un organismo: elige una familia, crea su genoma y
// construye sus puntos.
//
// Es el ÚNICO lugar del proyecto donde se usa Math.random(), y solo
// para inventar una semilla nueva cuando no nos dan una. Todo lo
// demás sale del generador con semilla.
// ============================================================

import { FamilyRegistry } from "../FamilyRegistry.js";
import { SeededRandom } from "../random/SeededRandom.js";
import { construirForma } from "../families/canonical.js";
import { Organism } from "../Organism.js";
import { createGenome } from "./createGenome.js";

/**
 * @param {number|string} [seed] si no viene, se inventa una
 * @returns {Organism}
 */
export function bornOrganism(seed) {
  // La única semilla realmente al azar de todo el proyecto.
  const semillaCruda = seed === undefined ? Math.floor(Math.random() * 2 ** 32) : seed;

  const rng = new SeededRandom(semillaCruda);
  // La semilla ya normalizada, para poder mostrarla y repetir el organismo.
  const semilla = rng.seed;

  // La familia se elige con la misma semilla: misma semilla, misma familia.
  const familia = rng.pick(FamilyRegistry.listFamilies());

  const genome = createGenome(familia, semilla);
  const shape = construirForma(familia, genome.parts);

  return new Organism({
    id: `${familia.id}:${semilla}`,
    familyId: familia.id,
    seed: semilla,
    genome,
    shape,
  });
}
