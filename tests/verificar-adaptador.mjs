#!/usr/bin/env node
// ============================================================
// tests/verificar-adaptador.mjs
//
// Pruebas del PUENTE entre el tracking real (participantes en
// píxeles) y el contrato de frame (0..1, 7 anclas, sin espejo).
//
// Sin dependencias, sin cámara: se arman participantes falsos.
//
//   node tests/verificar-adaptador.mjs
// ============================================================

import { TrackingAdapter } from "../src/input/TrackingAdapter.js";
import {
  CANTIDAD_DE_ANCLAS,
  CONFIANZA_MINIMA,
} from "../src/model/tracking/TrackingFrame.js";

const ANCHO = 640;
const ALTO = 480;

const reportes = [];

function crearReporte(nombre) {
  const reporte = { nombre, comprobaciones: 0, errores: [] };
  reportes.push(reporte);
  return reporte;
}

function comprobarEn(reporte) {
  return (condicion, mensaje) => {
    reporte.comprobaciones++;
    if (!condicion) reporte.errores.push(mensaje);
  };
}

/** Pose falsa con la misma interfaz que usa el adaptador: get(nombre). */
function poseFalsa(puntos, score = 0.9) {
  return {
    score,
    keypoints: Object.values(puntos),
    get: (nombre) => puntos[nombre] ?? null,
  };
}

/** Esqueleto de cintura hacia arriba, en píxeles del video. */
function esqueleto(centroX = 320, centroY = 220, anchoHombros = 120) {
  const dx = anchoHombros / 2;
  return {
    left_shoulder: { x: centroX - dx, y: centroY - 40, confidence: 0.9 },
    right_shoulder: { x: centroX + dx, y: centroY - 40, confidence: 0.9 },
    left_elbow: { x: centroX - dx - 40, y: centroY + 40, confidence: 0.8 },
    right_elbow: { x: centroX + dx + 40, y: centroY + 40, confidence: 0.8 },
    left_wrist: { x: centroX - dx - 60, y: centroY + 110, confidence: 0.7 },
    right_wrist: { x: centroX + dx + 60, y: centroY + 110, confidence: 0.7 },
    left_hip: { x: centroX - dx * 0.7, y: centroY + 120, confidence: 0.85 },
    right_hip: { x: centroX + dx * 0.7, y: centroY + 120, confidence: 0.85 },
  };
}

function participanteFalso({
  participantId = "p1",
  slotId = 0,
  state = "ACTIVE",
  puntos = esqueleto(),
  centro = { x: 320, y: 220 },
  score = 0.9,
} = {}) {
  return {
    slotId,
    participantId,
    state,
    pose: poseFalsa(puntos, score),
    center: centro,
    velocity: { x: 0, y: 0 },
    scale: 120,
    box: null,
  };
}

// ------------------------------------------------------------
// 1. Conversión básica
// ------------------------------------------------------------

{
  const reporte = crearReporte("Conversión: una persona activa");
  const comprobar = comprobarEn(reporte);
  const adaptador = new TrackingAdapter({ ancho: ANCHO, alto: ALTO });

  const frame = adaptador.update(
    { participants: [participanteFalso()], session: "PARTIAL" },
    1000
  );

  comprobar(frame.persons.length === 1, "debería haber una persona");
  const persona = frame.persons[0];

  comprobar(persona.id === "p1", "el id debería ser el participantId estable");
  comprobar(persona.present === true, "una persona ACTIVE debería estar presente");
  comprobar(
    persona.anchors.length === CANTIDAD_DE_ANCLAS,
    "el frame debería tener 7 anclas"
  );
  comprobar(
    persona.anchors.every((ancla) => ancla === null || (ancla.x >= 0 && ancla.x <= 1)),
    "todas las anclas deberían quedar normalizadas en x"
  );
  comprobar(
    Math.abs(persona.anchors[0].x - (320 - 60) / ANCHO) < 1e-9,
    "el hombro izquierdo debería salir de los píxeles del video"
  );
  comprobar(
    persona.anchors[6] !== null,
    "la cintura debería promediar las caderas"
  );
  comprobar(
    persona.center.x > 0.49 && persona.center.x < 0.51,
    "el centro debería quedar normalizado"
  );
  comprobar(persona.energy === 0, "sin frames previos no hay energía");
  comprobar(
    Object.isFrozen(frame) && Object.isFrozen(persona),
    "el frame debería volver congelado"
  );
  comprobar(
    persona.confidence > 0.8,
    "la confianza debería venir de la pose"
  );
}

// ------------------------------------------------------------
// 2. Movimiento, energía y velocidades
// ------------------------------------------------------------

{
  const reporte = crearReporte("Movimiento: energía y velocidad");
  const comprobar = comprobarEn(reporte);
  const adaptador = new TrackingAdapter({ ancho: ANCHO, alto: ALTO });

  adaptador.update({ participants: [participanteFalso()] }, 1000);

  // Se mueve 40 px en 0.5 s: un gesto real.
  const movido = esqueleto(360, 220, 120);
  const frame = adaptador.update(
    { participants: [participanteFalso({ puntos: movido })] },
    1500
  );

  const persona = frame.persons[0];
  comprobar(
    persona.energy > 0,
    "un gesto real debería producir energía mayor que 0"
  );
  comprobar(
    persona.energy <= 1,
    "la energía nunca debería pasar de 1"
  );
  comprobar(
    persona.anchors[0].vx > 0,
    "el hombro movido a la derecha debería tener vx positivo"
  );
  comprobar(
    Math.abs(persona.anchors[0].vy) <= 1 && Math.abs(persona.anchors[0].vx) <= 1,
    "las velocidades deberían quedar en -1..1"
  );

  // Quieto durante un segundo: la energía cae a 0.
  let quieto = persona;
  for (let i = 0; i < 60; i++) {
    quieto = adaptador.update(
      { participants: [participanteFalso({ puntos: movido })] },
      1550 + i * 16
    ).persons[0];
  }
  comprobar(quieto.energy < 0.01, "quieto, la energía debería caer a 0");
  comprobar(
    Math.abs(quieto.anchors[0].vx) < 1e-6,
    "quieto, las velocidades deberían ser 0"
  );
}

// ------------------------------------------------------------
// 3. Ausencia y pérdida de señal
// ------------------------------------------------------------

{
  const reporte = crearReporte("Presencia: LOST y ABSENT");
  const comprobar = comprobarEn(reporte);
  const adaptador = new TrackingAdapter({ ancho: ANCHO, alto: ALTO });

  adaptador.update({ participants: [participanteFalso()] }, 1000);

  const perdido = adaptador.update(
    { participants: [participanteFalso({ state: "LOST" })] },
    1100
  ).persons[0];

  comprobar(perdido.present === false, "LOST no debería contar como presente");
  comprobar(
    perdido.anchors.every((ancla) => ancla === null),
    "sin presencia no debería haber anclas"
  );
  comprobar(perdido.energy === 0, "sin presencia la energía debería ser 0");
  comprobar(perdido.id === "p1", "el id se conserva aunque esté perdido");

  const ausente = adaptador.update(
    { participants: [participanteFalso({ state: "ABSENT" })] },
    1200
  ).persons[0];
  comprobar(ausente.present === false, "ABSENT no debería contar como presente");
  comprobar(ausente.confidence === 0, "sin presencia la confianza debería ser 0");
}

// ------------------------------------------------------------
// 4. Dos personas y límites
// ------------------------------------------------------------

{
  const reporte = crearReporte("Dos personas: orden y máximo");
  const comprobar = comprobarEn(reporte);
  const adaptador = new TrackingAdapter({ ancho: ANCHO, alto: ALTO });

  const dos = adaptador.update(
    {
      participants: [
        participanteFalso({ participantId: "p2", slotId: 1, centro: { x: 480, y: 200 } }),
        participanteFalso({ participantId: "p1", slotId: 0 }),
      ],
    },
    1000
  );
  comprobar(dos.persons.length === 2, "deberían quedar dos personas");
  comprobar(
    dos.persons[0].id === "p2" && dos.persons[1].id === "p1",
    "se respeta el orden de los participantes"
  );

  const tres = adaptador.update(
    {
      participants: [
        participanteFalso({ participantId: "p1" }),
        participanteFalso({ participantId: "p2", slotId: 1 }),
        participanteFalso({ participantId: "p3", slotId: 2 }),
      ],
    },
    1016
  );
  comprobar(tres.persons.length === 2, "nunca debería haber más de dos personas");

  const vacio = adaptador.update({ participants: [] }, 1100);
  comprobar(vacio.persons.length === 0, "sin participantes el frame queda vacío");
  comprobar(
    vacio.timestamp === 1100,
    "el timestamp debería venir del reloj del tracker"
  );
}

// ------------------------------------------------------------
// 5. Keypoints con baja confianza
// ------------------------------------------------------------

{
  const reporte = crearReporte("Confianza: anclas descartadas");
  const comprobar = comprobarEn(reporte);
  const adaptador = new TrackingAdapter({ ancho: ANCHO, alto: ALTO });

  const puntos = esqueleto();
  puntos.left_wrist = { ...puntos.left_wrist, confidence: CONFIANZA_MINIMA / 2 };
  delete puntos.right_elbow;

  const frame = adaptador.update(
    { participants: [participanteFalso({ puntos })] },
    1000
  );
  const persona = frame.persons[0];

  comprobar(
    persona.anchors[4] === null,
    "una muñeca con poca confianza debería quedar en null"
  );
  comprobar(
    persona.anchors[3] === null,
    "un codo ausente debería quedar en null"
  );
  comprobar(
    persona.anchors[0] !== null,
    "las anclas confiables se conservan"
  );
}

// ------------------------------------------------------------
// Resumen
// ------------------------------------------------------------

let totalComprobaciones = 0;
let totalErrores = 0;

for (const reporte of reportes) {
  totalComprobaciones += reporte.comprobaciones;
  totalErrores += reporte.errores.length;

  const estado = reporte.errores.length === 0 ? "OK   " : "FALLÓ";
  console.log(`${estado}  ${reporte.nombre} — ${reporte.comprobaciones} comprobaciones`);

  for (const error of reporte.errores) {
    console.log(`        ✗ ${error}`);
  }
}

console.log("");
if (totalErrores === 0) {
  console.log(`TODO OK — ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
