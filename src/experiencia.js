// ============================================================
// experiencia.js
//
// PUNTO DE ENTRADA de la experiencia final (index.html).
//
// Compone todo el trabajo del proyecto:
//   cámara (bodypose/develop)
//   + fondo artístico opcional (develop)
//   + organismos generativos (feature/bodies)
//   + ciclo de vida y pose viva (feature/bodies)
//   + emociones e interacciones (feature/reaccions)
//
// Teclas: F fondo · D depuración del tracking · H ocultar HUD.
// ============================================================

import { CameraModel } from "../camera.js";
import { BodyPoseModel } from "../bodypose.js";
import { ParticipantTracker } from "../participants.js";
import { TrackingAdapter } from "./input/TrackingAdapter.js";
import { OrganismManager } from "./model/lifecycle/OrganismManager.js";
import { BehaviorBridge } from "./behavior/BehaviorBridge.js";
import { ExperienciaView } from "./view/ExperienciaView.js";
import { ExperienciaController } from "./controller/ExperienciaController.js";

let vista;
let controlador;
let camara;
let modelo;
let tracker;
let adaptador;

/** Enciende cámara y modelo; cualquier fallo se muestra en el HUD. */
async function arrancar() {
  try {
    controlador.estado("encendiendo cámara…");
    await camara.start();

    tracker.setFrameSize(camara.width, camara.height);
    adaptador.setFrameSize(camara.width, camara.height);

    controlador.estado("cargando modelo de pose…");
    await modelo.load();

    controlador.estado(null);
    modelo.start(camara.video, (poses) => {
      controlador.ingestPoses(poses, performance.now());
    });
  } catch (error) {
    console.error(error);
    controlador.estado(error.message);
  }
}

new p5((p) => {
  vista = new ExperienciaView(p);

  p.preload = () => {
    vista.precargar();
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);

    tracker = new ParticipantTracker();
    adaptador = new TrackingAdapter({ ancho: 640, alto: 480 });
    camara = new CameraModel();
    modelo = new BodyPoseModel();

    controlador = new ExperienciaController({
      manager: new OrganismManager(),
      tracker,
      adapter: adaptador,
      behaviors: new BehaviorBridge(),
      view: vista,
      camara,
    });

    // Acceso desde la consola para depurar en la instalación.
    window.cuerpitos = { controlador, vista, camara };

    arrancar();
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
    if (p.key === "f" || p.key === "F") vista.cambiarFondo();
    if (p.key === "d" || p.key === "D") vista.alternarDepuracion();
    if (p.key === "h" || p.key === "H") vista.alternarHud();
  };
});
