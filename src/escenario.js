// ============================================================
// escenario.js
//
// Página de prueba del tracking: un organismo (o dos) controlados
// por el MockTracker, con la pose viva y la depuración.
//
// ?seed=123 repite el organismo.
// Teclas: 1–5 modo del mock · D depuración · F fondo · ESPACIO nueva semilla.
// ============================================================

import { bornOrganism } from "./model/genome/bornOrganism.js";
import { crearVinculos } from "./model/tracking/crearVinculos.js";
import { OrganismPose } from "./model/tracking/OrganismPose.js";
import { MockTracker } from "./input/MockTracker.js";
import { EscenarioView } from "./view/EscenarioView.js";
import { EscenarioController } from "./controller/EscenarioController.js";

const MODOS = ["raton", "lissajous", "dos", "quieto", "perdida"];

const parametros = new URLSearchParams(window.location.search);
let semilla = parametros.get("seed") ?? undefined;

let vista;
let controlador;

function armarEscenario() {
  const organismo = bornOrganism(semilla);
  const vinculos = crearVinculos(organismo.shape, organismo.seed);
  const pose = new OrganismPose(organismo.shape, vinculos);

  const tracker = new MockTracker({ modo: "lissajous", semilla: organismo.seed });

  controlador = new EscenarioController({
    organismo,
    pose,
    vinculos,
    tracker,
    view: vista,
  });
}

new p5((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    vista = new EscenarioView(p);
    armarEscenario();
  };

  p.draw = () => {
    // delta time en segundos, con un tope por si la pestaña estuvo dormida.
    const dt = Math.min(0.1, p.deltaTime / 1000);

    controlador.update(dt);
    controlador.render();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.keyPressed = () => {
    if (p.key >= "1" && p.key <= "5") {
      controlador.tracker.setModo(MODOS[Number(p.key) - 1]);
    } else if (p.key === "d" || p.key === "D") {
      vista.alternarDepuracion();
    } else if (p.key === "f" || p.key === "F") {
      vista.cambiarFondo();
    } else if (p.keyCode === 32) {
      semilla = undefined;
      armarEscenario();
    }
  };

  p.mouseMoved = () => {
    if (controlador.tracker.modo === "raton") {
      controlador.tracker.moverA(p.mouseX / p.width, p.mouseY / p.height);
    }
  };
});
