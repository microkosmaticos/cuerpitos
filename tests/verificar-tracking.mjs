#!/usr/bin/env node
// ============================================================
// tests/verificar-tracking.mjs
//
// Pruebas del contrato de tracking y del tracker falso.
// Sin dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-tracking.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
// ============================================================

import {
  CANTIDAD_DE_ANCLAS,
  MAXIMO_DE_PERSONAS,
  validarFrame,
} from "../src/model/tracking/TrackingFrame.js";
import { MockTracker, MODOS } from "../src/input/MockTracker.js";

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

function personaDePrueba(extra = {}) {
  return {
    id: "p0",
    present: true,
    confidence: 0.9,
    center: { x: 0.5, y: 0.5 },
    energy: 0.5,
    spread: 0.5,
    anchors: Array.from({ length: CANTIDAD_DE_ANCLAS }, (_, i) => ({
      x: 0.4 + i * 0.01,
      y: 0.4,
      vx: 0,
      vy: 0,
      confidence: 0.9,
    })),
    ...extra,
  };
}

// ------------------------------------------------------------
// 1. Validación del frame
// ------------------------------------------------------------

{
  const reporte = crearReporte("Validación: casos límite");
  const comprobar = comprobarEn(reporte);

  const vacio = validarFrame(null);
  comprobar(vacio.timestamp === 0, "un frame nulo debería dar timestamp 0");
  comprobar(Array.isArray(vacio.persons) && vacio.persons.length === 0, "un frame nulo no debería tener personas");
  comprobar(Object.isFrozen(vacio), "el frame validado debería estar congelado");

  const sinArray = validarFrame({ timestamp: 5, persons: "no soy un array" });
  comprobar(sinArray.persons.length === 0, "persons que no es array debería quedar vacío");

  const timestampMalo = validarFrame({ timestamp: NaN, persons: [] });
  comprobar(timestampMalo.timestamp === 0, "timestamp NaN debería pasar a 0");
}

{
  const reporte = crearReporte("Validación: NaN, infinitos y recortes");
  const comprobar = comprobarEn(reporte);

  const frame = validarFrame({
    timestamp: 10,
    persons: [
      personaDePrueba({
        center: { x: NaN, y: 2 },
        energy: 5,
        spread: -1,
        confidence: Infinity,
        anchors: [
          { x: 0.1, y: 0.2, vx: 0, vy: 0, confidence: 0.9 },
          { x: NaN, y: 0.2, confidence: 0.9 },
          { x: 0.1, y: Infinity, confidence: 0.9 },
          { x: -0.5, y: 1.5, vx: 10, vy: -10, confidence: 0.9 },
        ],
      }),
    ],
  });

  const persona = frame.persons[0];

  comprobar(persona.center.x === 0.5, "center.x NaN debería caer al valor por defecto 0.5");
  comprobar(persona.center.y === 1, "center.y 2 debería recortarse a 1");
  comprobar(persona.energy === 1, "energy 5 debería recortarse a 1");
  comprobar(persona.spread === 0, "spread -1 debería recortarse a 0");
  comprobar(persona.confidence === 0, "confidence Infinity debería quedar en 0");

  comprobar(persona.anchors.length === CANTIDAD_DE_ANCLAS, "los anchors deberían rellenarse a 7");
  comprobar(persona.anchors[1] === null, "un anchor con x NaN debería quedar en null");
  comprobar(persona.anchors[2] === null, "un anchor con y Infinity debería quedar en null");
  comprobar(persona.anchors[3] !== null, "un anchor fuera de rango pero finito debería sobrevivir");
  comprobar(persona.anchors[3].x === 0, "anchor.x -0.5 debería recortarse a 0");
  comprobar(persona.anchors[3].y === 1, "anchor.y 1.5 debería recortarse a 1");
  comprobar(persona.anchors[3].vx === 1, "anchor.vx 10 debería recortarse a 1");
  comprobar(persona.anchors[3].vy === -1, "anchor.vy -10 debería recortarse a -1");
  comprobar(persona.anchors[4] === null, "un anchor faltante debería quedar en null");
}

{
  const reporte = crearReporte("Validación: confianza, ids y cantidad de personas");
  const comprobar = comprobarEn(reporte);

  const frame = validarFrame({
    persons: [
      personaDePrueba({
        id: "p0",
        anchors: [{ x: 0.5, y: 0.5, confidence: 0.1 }],
      }),
      personaDePrueba({ id: "p1", center: { x: 0.2, y: 0.3 } }),
      personaDePrueba({ id: "p2", center: { x: 0.8, y: 0.9 } }),
    ],
  });

  comprobar(frame.persons.length === MAXIMO_DE_PERSONAS, "no debería aceptar más de 2 personas");
  comprobar(frame.persons[0].anchors[0] === null, "un anchor con confianza 0.1 debería quedar en null");
  comprobar(frame.persons[1].id === "p1", "el id de la segunda persona debería conservarse");

  const sinId = validarFrame({ persons: [{ center: { x: 0.3, y: 0.3 } }] });
  comprobar(sinId.persons[0].id === "p0", "una persona sin id debería recibir uno automático");
}

// ------------------------------------------------------------
// 2. MockTracker
// ------------------------------------------------------------

{
  const reporte = crearReporte("Mock: los 5 modos producen frames válidos");
  const comprobar = comprobarEn(reporte);

  for (const modo of MODOS) {
    const mock = new MockTracker({ modo, semilla: 3 });
    const frame = mock.update(1 / 60, 16);

    const limpio = validarFrame(frame);
    comprobar(
      JSON.stringify(limpio) === JSON.stringify(frame),
      `modo "${modo}": el frame ya debería venir válido`
    );
    comprobar(frame.persons.length >= 1, `modo "${modo}": debería haber al menos una persona`);
    comprobar(
      frame.persons[0].anchors.length === CANTIDAD_DE_ANCLAS,
      `modo "${modo}": debería traer los 7 anchors`
    );
  }
}

{
  const reporte = crearReporte("Mock: lissajous se mueve");
  const comprobar = comprobarEn(reporte);

  const mock = new MockTracker({ modo: "lissajous", semilla: 5 });

  let minimo = Infinity;
  let maximo = -Infinity;
  let energiaMaxima = 0;

  // Tres segundos a 60 fps.
  for (let i = 0; i < 180; i++) {
    const frame = mock.update(1 / 60);
    minimo = Math.min(minimo, frame.persons[0].center.x);
    maximo = Math.max(maximo, frame.persons[0].center.x);
    energiaMaxima = Math.max(energiaMaxima, frame.persons[0].energy);
  }

  comprobar(maximo - minimo > 0.05, `el centro debería recorrer más de 0.05 y recorrió ${(maximo - minimo).toFixed(3)}`);
  comprobar(energiaMaxima > 0, "energy debería ser mayor que 0 en algún momento");

  const ultimo = mock.update(1 / 60);
  comprobar(ultimo.persons[0].present === true, "la persona debería estar presente");
}

{
  const reporte = crearReporte("Mock: quieto no se mueve");
  const comprobar = comprobarEn(reporte);

  const mock = new MockTracker({ modo: "quieto" });
  const primero = mock.update(1 / 60);

  for (let i = 0; i < 120; i++) mock.update(1 / 60);

  const despues = mock.update(1 / 60);

  comprobar(despues.persons[0].energy === 0, "energy debería ser exactamente 0");
  comprobar(
    despues.persons[0].center.x === primero.persons[0].center.x &&
      despues.persons[0].center.y === primero.persons[0].center.y,
    "el centro no debería moverse"
  );
}

{
  const reporte = crearReporte("Mock: dos personas independientes");
  const comprobar = comprobarEn(reporte);

  const mock = new MockTracker({ modo: "dos", semilla: 9 });
  for (let i = 0; i < 30; i++) mock.update(1 / 60);
  const frame = mock.update(1 / 60);

  comprobar(frame.persons.length === 2, "deberían ser dos personas");
  comprobar(frame.persons[0].id !== frame.persons[1].id, "deberían tener ids distintos");
  comprobar(
    frame.persons[0].center.x !== frame.persons[1].center.x ||
      frame.persons[0].center.y !== frame.persons[1].center.y,
    "deberían estar en lugares distintos"
  );
}

{
  const reporte = crearReporte("Mock: pérdida de señal");
  const comprobar = comprobarEn(reporte);

  const mock = new MockTracker({ modo: "perdida", semilla: 2 });

  // Antes de los 3 segundos está presente.
  for (let i = 0; i < 60; i++) mock.update(1 / 60);
  const antes = mock.update(1 / 60);
  comprobar(antes.persons[0].present === true, "antes de los 3 s debería estar presente");

  // Después de los 3 segundos se pierde.
  for (let i = 0; i < 150; i++) mock.update(1 / 60);
  const despues = mock.update(1 / 60);

  comprobar(despues.persons[0].present === false, "después de los 3 s debería estar ausente");
  comprobar(despues.persons[0].energy === 0, "sin señal la energía debería ser 0");
  comprobar(
    despues.persons[0].anchors.every((anchor) => anchor === null),
    "sin señal los anchors deberían venir vacíos"
  );
}

{
  const reporte = crearReporte("Mock: ratón sigue el cursor");
  const comprobar = comprobarEn(reporte);

  const mock = new MockTracker({ modo: "raton" });
  const inicio = mock.update(1 / 60);

  mock.moverA(0.85, 0.25);
  for (let i = 0; i < 120; i++) mock.update(1 / 60);

  const fin = mock.update(1 / 60);

  comprobar(
    fin.persons[0].center.x > inicio.persons[0].center.x + 0.2,
    "el centro debería acercarse al cursor"
  );
  comprobar(
    Math.abs(fin.persons[0].center.x - 0.85) < 0.05,
    "el centro debería llegar cerca del cursor"
  );
}

{
  const reporte = crearReporte("Mock: misma semilla, mismos frames");
  const comprobar = comprobarEn(reporte);

  const uno = new MockTracker({ modo: "lissajous", semilla: 42 });
  const dos = new MockTracker({ modo: "lissajous", semilla: 42 });

  let iguales = true;
  for (let i = 0; i < 60; i++) {
    const a = uno.update(1 / 60);
    const b = dos.update(1 / 60);
    if (JSON.stringify(a) !== JSON.stringify(b)) iguales = false;
  }

  comprobar(iguales, "dos mocks con la misma semilla deberían dar frames idénticos");
}

// ------------------------------------------------------------
// Salida
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
