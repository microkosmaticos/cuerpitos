// ============================================================
// Organism.js
//
// Un organismo ya nacido. Guarda su identidad y sus puntos.
//
// Todavía NO tiene posición ni movimiento: eso viene cuando se
// conecte con el tracking. Por ahora es un cuerpo quieto.
//
// Todo queda congelado: sus proporciones no cambian durante toda
// su aparición (regla de agent.md).
// ============================================================

import { congelarProfundo } from "./families/deepFreeze.js";

export class Organism {
  /**
   * @param {object} datos
   * @param {string} datos.id identificador estable
   * @param {string} datos.familyId familia de la que nació
   * @param {number} datos.seed semilla que lo generó
   * @param {object} datos.genome genoma congelado
   * @param {object} datos.shape forma ya construida (con puntos)
   */
  constructor({ id, familyId, seed, genome, shape }) {
    this.id = id;
    this.familyId = familyId;
    this.seed = seed;
    this.genome = genome;
    this.shape = shape;

    // Nadie puede cambiar sus proporciones después de nacer.
    congelarProfundo(this);
  }
}
