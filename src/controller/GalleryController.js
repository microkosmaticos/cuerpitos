// ============================================================
// GalleryController.js
//
// El CONTROLADOR de la galería. Coordina: sabe qué familia se está
// mirando, le pide al modelo su forma canónica y le pide a la vista
// que la dibuje. No dibuja ni define anatomías.
// ============================================================

import { construirCanonica } from "../model/families/canonical.js";

export class GalleryController {
  /**
   * @param {object[]} familias lista que entrega FamilyRegistry
   * @param {import("../view/FamilyGalleryView.js").FamilyGalleryView} view
   */
  constructor(familias, view) {
    this.familias = familias;
    this.view = view;
    this.index = 0;
    // La canónica se arma una sola vez por familia y se guarda.
    this.canonicas = new Map();
  }

  currentFamily() {
    return this.familias[this.index];
  }

  /** Forma canónica de la familia actual, ya con sus puntos. */
  currentShape() {
    const familia = this.currentFamily();

    if (!this.canonicas.has(familia.id)) {
      this.canonicas.set(familia.id, construirCanonica(familia));
    }

    return this.canonicas.get(familia.id);
  }

  next() {
    this.index = (this.index + 1) % this.familias.length;
  }

  previous() {
    this.index = (this.index - 1 + this.familias.length) % this.familias.length;
  }

  /** Pinta el estado actual. Se llama una vez por frame. */
  render() {
    const forma = this.currentShape();
    this.view.draw(forma);
    this.view.drawHud(forma, this.index, this.familias.length);
  }
}
