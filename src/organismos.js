// ============================================================
// organismos.js
//
// Punto de entrada de la galería de organismos (sin webcam).
//
// Con ?seed=123 en la URL se repite exactamente el mismo organismo.
// ESPACIO hace nacer otro y G alterna entre uno y seis.
// ============================================================

import { OrganismGalleryView } from "./view/OrganismGalleryView.js";
import { OrganismGalleryController } from "./controller/OrganismGalleryController.js";

// Semilla de la URL, si viene. Es texto; el modelo la normaliza.
const parametros = new URLSearchParams(window.location.search);
const semillaDeLaUrl = parametros.get("seed") ?? undefined;

let vista;
let controlador;

new p5((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    vista = new OrganismGalleryView(p);
    controlador = new OrganismGalleryController(vista, semillaDeLaUrl);
  };

  p.draw = () => {
    p.background(11, 11, 18);
    controlador.render();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.keyPressed = () => {
    if (p.keyCode === 32 || p.key === "n" || p.key === "N") {
      controlador.accionarTeclaEspacio();
    } else if (p.key === "g" || p.key === "G") {
      controlador.alternarVista();
    }
  };
});
