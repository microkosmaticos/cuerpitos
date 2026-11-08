// ============================================================
// escenario.js
//
// Página de prueba del ciclo de vida: los organismos nacen cuando
// una persona válida aparece y se desvanecen cuando se va.
//
// ?seed=123 repite la secuencia (la semilla inicial y el mock).
// Teclas: 1–5 modo · D depuración · E eventos · F fondo · ESPACIO reiniciar.
// ============================================================

import { OrganismManager } from "./model/lifecycle/OrganismManager.js";
import { MockTracker } from "./input/MockTracker.js";
import { EscenarioView } from "./view/EscenarioView.js";
import { EscenarioController } from "./controller/EscenarioController.js";

const MODOS = [
  "raton",
  "lissajous",
  "dos",
  "quieto",
  "perdida",
  "entra-y-sale",
  "parpadeo",
  "dos-escalonado",
];

const parametros = new URLSearchParams(window.location.search);
const semillaInicial = parametros.get("seed") ?? null;

let vista;
let controlador;
let gestor;

/** Fuente de semillas determinista si hay ?seed= en la URL. */
function crearFuenteDeSemillas() {
  if (semillaInicial === null) return null;

  let siguiente = Number(semillaInicial);
  if (!Number.isFinite(siguiente)) return null;

  return () => {
    const semilla = siguiente;
    siguiente += 1;
    return semilla;
  };
}

function armarEscenario() {
  const tracker = new MockTracker({
    modo: "lissajous",
    semilla: semillaInicial !== null ? Number(semillaInicial) || 1 : 1,
  });

  gestor = new OrganismManager({ fuenteDeSemillas: crearFuenteDeSemillas() });

  controlador = new EscenarioController({ manager: gestor, tracker, view: vista });
}

new p5((p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    vista = new EscenarioView(p);
    armarEscenario();
  };

  p.draw = () => {
    const dt = Math.min(0.1, p.deltaTime / 1000);

    controlador.update(dt);
    controlador.render();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.keyPressed = () => {
    if (p.key >= "1" && p.key <= "8") {
      controlador.tracker.setModo(MODOS[Number(p.key) - 1]);
    } else if (p.key === "d" || p.key === "D") {
      vista.alternarDepuracion();
    } else if (p.key === "e" || p.key === "E") {
      vista.alternarEventos();
    } else if (p.key === "f" || p.key === "F") {
      vista.cambiarFondo();
    } else if (p.keyCode === 32) {
      armarEscenario();
    }
  };

  p.mouseMoved = () => {
    if (controlador.tracker.modo === "raton") {
      controlador.tracker.moverA(p.mouseX / p.width, p.mouseY / p.height);
    }
  };
});
