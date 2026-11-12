#!/usr/bin/env node
// ============================================================
// tests/verificar-pose.mjs
//
// Pruebas de la adaptación de una detección cruda de ml5 a la Pose
// que usa el tracking.
//
// Lo importante que se cubre acá:
//   - el encuadre es de cintura hacia arriba: las piernas fuera de
//     cuadro (confianza 0) NO pueden hundir la confianza de la persona;
//   - los keypoints pueden venir como propiedades sueltas o solo
//     dentro del array con `name`.
//
//   node tests/verificar-pose.mjs
// ============================================================

import { Pose } from "../pose.js";

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

/** Detección cruda al estilo ml5: todo dentro de `keypoints` con name. */
function deteccionCruda({ piernasFuera = true } = {}) {
  const arriba = [
    ["nose", 320, 120, 0.9],
    ["left_eye", 308, 112, 0.9],
    ["right_eye", 332, 112, 0.9],
    ["left_ear", 296, 120, 0.9],
    ["right_ear", 344, 120, 0.9],
    ["left_shoulder", 260, 200, 0.95],
    ["right_shoulder", 380, 200, 0.95],
    ["left_elbow", 220, 280, 0.9],
    ["right_elbow", 420, 280, 0.9],
    ["left_wrist", 200, 360, 0.85],
    ["right_wrist", 440, 360, 0.85],
    ["left_hip", 280, 400, 0.8],
    ["right_hip", 360, 400, 0.8],
  ];

  const abajo = [
    ["left_knee", 280, 560, 0],
    ["right_knee", 360, 560, 0],
    ["left_ankle", 280, 700, 0],
    ["right_ankle", 360, 700, 0],
  ];

  const puntos = piernasFuera ? [...arriba, ...abajo] : arriba;

  return {
    keypoints: puntos.map(([name, x, y, confidence]) => ({
      name,
      x,
      y,
      confidence,
    })),
  };
}

// ------------------------------------------------------------
// 1. Keypoints solo en el array, con name
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: keypoints con name en el array");
  const comprobar = comprobarEn(reporte);

  const pose = new Pose(deteccionCruda());

  comprobar(
    pose.get("left_shoulder")?.x === 260,
    "debería encontrar el hombro dentro del array"
  );
  comprobar(
    pose.get("no_existe") === null,
    "un keypoint inexistente debería ser null"
  );
  comprobar(
    pose.hasTorso(),
    "con hombros y caderas visibles debería tener torso"
  );
  comprobar(
    Math.abs(pose.center.x - 320) < 30,
    "el centro debería salir del torso"
  );
  comprobar(pose.scale > 100, "la escala debería ser el ancho de hombros");
}

// ------------------------------------------------------------
// 2. La confianza no se hunde por las piernas fuera de cuadro
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: confianza sin piernas");
  const comprobar = comprobarEn(reporte);

  const conPiernas = new Pose(deteccionCruda({ piernasFuera: true }));
  const sinPiernas = new Pose(deteccionCruda({ piernasFuera: false }));

  comprobar(
    conPiernas.score > 0.6,
    `con piernas en 0 la confianza igual debería superar 0.6 (dio ${conPiernas.score.toFixed(2)})`
  );
  comprobar(
    Math.abs(conPiernas.score - sinPiernas.score) < 0.001,
    "tener o no las piernas en el array no debería cambiar la confianza"
  );
  comprobar(
    conPiernas.score <= 1 && conPiernas.score >= 0,
    "la confianza debería quedar en 0..1"
  );
}

// ------------------------------------------------------------
// 3. Keypoints como propiedades sueltas
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: propiedades sueltas");
  const comprobar = comprobarEn(reporte);

  const cruda = deteccionCruda();
  const plano = {};
  for (const punto of cruda.keypoints) plano[punto.name] = punto;

  const pose = new Pose({ ...plano, keypoints: [] });

  comprobar(
    pose.get("right_wrist")?.x === 440,
    "debería aceptar las propiedades sueltas"
  );
  comprobar(pose.score > 0.6, "la confianza debería salir igual de alta");
  comprobar(pose.hasTorso(), "el torso debería detectarse igual");
}

// ------------------------------------------------------------
// 4. Score del modelo cuando viene informado
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: score del modelo");
  const comprobar = comprobarEn(reporte);

  const pose = new Pose({ ...deteccionCruda(), score: 0.42 });

  comprobar(
    pose.score === 0.42,
    "si el modelo informa un score, se respeta"
  );
}

// ------------------------------------------------------------
// 5. Detección vacía
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: detección vacía");
  const comprobar = comprobarEn(reporte);

  const pose = new Pose({});
  comprobar(pose.get("left_shoulder") === null, "sin datos no hay keypoints");
  comprobar(pose.score === 0, "sin datos la confianza es 0");
  comprobar(pose.hasTorso() === false, "sin datos no hay torso");
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
