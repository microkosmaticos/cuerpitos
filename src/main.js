// ============================================================
// main.js
//
// Punto de entrada. Acá se conecta todo:
//   1. carga los datos de las formas,
//   2. crea la vista y el controlador,
//   3. arranca p5 y le pasa las teclas al controlador.
//
// En Paso A no hay cámara: solo se muestran las formas.
// ============================================================

import { SHAPES } from "./model/shapes.data.js";
import { loadShapes } from "./model/ShapeLoader.js";
import { OrganismView } from "./view/OrganismView.js";
import { AppController } from "./controller/AppController.js";

// Los datos crudos se convierten una sola vez, al arrancar.
const formas = loadShapes(SHAPES);

let vista;
let controlador;

// p5 se usa en "modo instancia" para que funcione con módulos ES.
new p5((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    vista = new OrganismView(p);
    controlador = new AppController(formas, vista);
  };

  p.draw = () => {
    // Fondo oscuro para que las formas se vean bien.
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
