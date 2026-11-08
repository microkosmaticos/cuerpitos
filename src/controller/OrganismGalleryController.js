// ============================================================
// OrganismGalleryController.js
//
// El CONTROLADOR. Sabe qué organismo se está mirando, en qué modo
// (uno o seis) y responde a las teclas. No dibuja ni sortea nada:
// le pide un organismo nuevo al modelo y se lo pasa a la vista.
// ============================================================

import { bornOrganism } from "../model/genome/bornOrganism.js";

const CANTIDAD_EN_GRILLA = 6;

export class OrganismGalleryController {
  /**
   * @param {import("../view/OrganismGalleryView.js").OrganismGalleryView} view
   * @param {number|string} [semillaInicial] si no viene, se inventa
   */
  constructor(view, semillaInicial) {
    this.view = view;
    this.modo = "uno";
    this.organismos = [bornOrganism(semillaInicial)];
    this.grilla = null;
  }

  /** Nace un organismo nuevo, con la semilla que le pasen o una nueva. */
  nacer(semilla) {
    this.organismos = [bornOrganism(semilla)];
    this.grilla = null;
  }

  /** Alterna entre ver uno y ver seis. */
  alternarVista() {
    if (this.modo === "uno") {
      if (!this.grilla) {
        this.grilla = Array.from({ length: CANTIDAD_EN_GRILLA }, () => bornOrganism());
      }
      this.modo = "seis";
    } else {
      this.modo = "uno";
    }
  }

  /** ¿Estamos viendo la grilla? */
  get enGrilla() {
    return this.modo === "seis";
  }

  /** Cambia el fondo de prueba: oscuro, medio o cámara simulada. */
  cambiarFondo() {
    this.view.cambiarFondo();
  }

  /** Se llama una vez por frame. */
  render() {
    if (this.modo === "seis") {
      this.view.draw(this.grilla, "seis");
    } else {
      this.view.draw(this.organismos, "uno");
    }
  }

  /** ESPACIO: en modo uno nace otro; en grilla nacen otros seis. */
  accionarTeclaEspacio() {
    if (this.modo === "seis") {
      this.grilla = Array.from({ length: CANTIDAD_EN_GRILLA }, () => bornOrganism());
    } else {
      this.nacer();
    }
  }
}
