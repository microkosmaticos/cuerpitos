// ============================================================
// experiencia.js
//
// PUNTO DE ENTRADA de la experiencia final (index.html).
//
// Todo arranca solo: cámara, modelo, organismos y comportamientos.
// No hay teclas ni modos que activar.
//
//   cámara (bodypose/develop)
//   + organismos generativos (feature/bodies)
//   + ciclo de vida y pose viva (feature/bodies)
//   + emociones e interacciones (feature/reaccions)
//
// Si la cámara o el modelo fallan, se reintenta automáticamente y el
// HUD explica qué está pasando.
// ============================================================

import { CameraModel } from "../camera.js";
import { BodyPoseModel } from "../bodypose.js";
import { ParticipantTracker } from "../participants.js";
import { TrackingAdapter } from "./input/TrackingAdapter.js";
import { OrganismManager } from "./model/lifecycle/OrganismManager.js";
import { BehaviorBridge } from "./behavior/BehaviorBridge.js";
import { ExperienciaView } from "./view/ExperienciaView.js";
import { crearFondoArtistico } from "./view/FondoArtistico.js";
import { ExperienciaController } from "./controller/ExperienciaController.js";

/** Intentos automáticos antes de rendirse. */
const INTENTOS = 3;

/** Espera entre intentos, en ms. */
const ESPERA_ENTRE_INTENTOS = 2000;

/** Tiempo máximo para cargar el modelo, en ms. */
const LIMITE_DEL_MODELO = 45000;

let vista;
let fondo;
let controlador;
let camara;
let modelo;
let tracker;
let adaptador;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Corre una promesa con límite de tiempo, para no quedar colgado. */
function conLimite(promesa, ms, leyenda) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error(leyenda)), ms)
    ),
  ]);
}

/** Enciende cámara y modelo, con reintentos automáticos. */
async function arrancar() {
  let ultimoError = null;

  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      controlador.estado(
        intento === 1 ? "encendiendo cámara…" : `reintentando (${intento}/${INTENTOS})…`
      );

      await camara.start();

      tracker.setFrameSize(camara.width, camara.height);
      adaptador.setFrameSize(camara.width, camara.height);

      controlador.estado("cargando modelo de pose…");
      await conLimite(
        modelo.load(),
        LIMITE_DEL_MODELO,
        "el modelo de pose tardó demasiado en cargar"
      );

      controlador.estado(null);
      modelo.start(camara.video, (poses) => {
        controlador.ingestPoses(poses, performance.now());
      });
      return;
    } catch (error) {
      ultimoError = error;
      console.error(error);

      controlador.estado(`${error.message} · reintentando ${intento}/${INTENTOS}…`);
      await esperar(ESPERA_ENTRE_INTENTOS);
    }
  }

  controlador.estado(
    `no se pudo iniciar la experiencia: ${ultimoError?.message ?? "error desconocido"}`
  );
}

new p5((p) => {
  vista = new ExperienciaView(p);
  fondo = crearFondoArtistico(p);

  p.preload = () => {
    fondo.precargar();
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);
    p.canvas.classList.add("lienzo-experiencia");

    // El fondo artístico se analiza una sola vez, con el canvas ya creado.
    fondo.configurar();

    tracker = new ParticipantTracker();
    adaptador = new TrackingAdapter({ ancho: 640, alto: 480 });
    camara = new CameraModel({ visible: true });
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

    // Fondo primero: repinta toda la pantalla y limpia el cuadro anterior.
    fondo.dibujar();

    controlador.update(dt);
    controlador.render();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
});
