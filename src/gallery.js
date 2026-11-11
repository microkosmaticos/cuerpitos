// ============================================================
// gallery.js
//
// Punto de entrada de la galería de familias (sin webcam).
// Conecta el registro, la vista y el controlador, y arranca p5.
// ============================================================

import { FamilyRegistry } from "./model/FamilyRegistry.js";
import { FamilyGalleryView } from "./view/FamilyGalleryView.js";
import { GalleryController } from "./controller/GalleryController.js";

const familias = FamilyRegistry.listFamilies();

let vista;
let controlador;

new p5((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    vista = new FamilyGalleryView(p);
    controlador = new GalleryController(familias, vista);
  };

  p.draw = () => {
    p.background(11, 11, 18);
    controlador.render();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.keyPressed = () => {
    if (p.keyCode === p.RIGHT_ARROW || p.key === "d" || p.key === "D") {
      controlador.next();
    } else if (p.keyCode === p.LEFT_ARROW || p.key === "a" || p.key === "A") {
      controlador.previous();
    }
  };
});
