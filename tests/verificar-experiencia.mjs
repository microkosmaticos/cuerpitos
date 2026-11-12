#!/usr/bin/env node
// ============================================================
// tests/verificar-experiencia.mjs
//
// PRUEBA DE INTEGRACIÓN de la experiencia completa, sin navegador:
//
//   MockTracker → OrganismManager → poses → comportamientos → items
//
// Sirve para comprobar que las piezas de las cuatro líneas de
// trabajo se hablan: nacimiento, desaparición, renacimiento, pose
// viva y registro de comportamientos.
//
//   node tests/verificar-experiencia.mjs
// ============================================================

import { MockTracker } from "../src/input/MockTracker.js";
import {
  OrganismManager,
  OrganismPose,
  crearVinculos,
  bornOrganism,
} from "../bodies.js";
import { BehaviorBridge } from "../src/behavior/BehaviorBridge.js";
import { ExperienciaController } from "../src/controller/ExperienciaController.js";
import { EMOTIONS } from "../reaccions.js";

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

/** Fuente de semillas determinista (1, 2, 3, ...). */
function fuenteDeSemillas() {
  let siguiente = 1;
  return () => siguiente++;
}

/**
 * Arma un controller con el mock ya conectado. El adaptador es un
 * pasamanos: el mock ya entrega frames del contrato.
 */
function armarExperiencia({ modo = "dos", semilla = 7 } = {}) {
  const reloj = { t: 1000 };
  const mock = new MockTracker({ modo, semilla });

  const manager = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas() });

  const behaviors = new BehaviorBridge({ ahora: () => reloj.t });

  const controller = new ExperienciaController({
    manager,
    tracker: null,
    adapter: { update: (resultado) => resultado },
    behaviors,
    view: null,
    reloj: () => reloj.t,
  });

  return { mock, manager, behaviors, controller, reloj };
}

/** Corre la experiencia durante `segundos` a 60 fps. */
function correr(experiencia, segundos, alPaso = null) {
  const paso = 1 / 60;
  const pasos = Math.round(segundos * 60);

  for (let i = 0; i < pasos; i++) {
    experiencia.reloj.t += paso * 1000;
    const frame = experiencia.mock.update(paso, experiencia.reloj.t);
    experiencia.controller.ingestFrame(frame, experiencia.reloj.t);
    experiencia.controller.update(paso);

    if (alPaso) alPaso(experiencia, i);
  }
}

// ------------------------------------------------------------
// 0. El punto de entrada de los avatares
// ------------------------------------------------------------

{
  const reporte = crearReporte("bodies.js: API de avatares");
  const comprobar = comprobarEn(reporte);

  comprobar(typeof OrganismManager === "function", "falta OrganismManager");
  comprobar(typeof OrganismPose === "function", "falta OrganismPose");
  comprobar(typeof crearVinculos === "function", "falta crearVinculos");
  comprobar(typeof bornOrganism === "function", "falta bornOrganism");

  const organismo = bornOrganism(123);
  comprobar(
    organismo.shape && organismo.palette && organismo.seed === 123,
    "bornOrganism debería devolver un avatar con forma y paleta"
  );
  comprobar(
    organismo.id === `${organismo.familyId}:${organismo.seed}`,
    "el id del avatar debería incluir familia y semilla"
  );
}

// ------------------------------------------------------------
// 1. Nacimiento de dos organismos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Nacimiento: dos personas, dos organismos");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "dos" });

  correr(experiencia, 5);

  const items = experiencia.controller.items;

  comprobar(items.length === 2, "deberían nacer dos organismos");
  comprobar(
    items.every((item) => item.estado === "vivo"),
    "a los 5 segundos los dos deberían estar vivos"
  );
  comprobar(
    items.every((item) => item.personaId === "p0" || item.personaId === "p1"),
    "cada organismo queda emparejado con una persona"
  );
  comprobar(
    new Set(items.map((item) => item.organismo.id)).size === 2,
    "los organismos son distintos"
  );
  comprobar(
    items.every((item) => EMOTIONS[item.emocion] !== undefined),
    "la emoción reportada existe en el catálogo"
  );
  comprobar(
    items.every((item) => item.pose && item.pose.partes instanceof Map),
    "cada organismo tiene pose viva"
  );
  comprobar(
    experiencia.behaviors.organismos().length === 2,
    "los dos organismos quedaron registrados en los comportamientos"
  );

  // Con movimiento del mock, la pose se deforma.
  const deformados = items.some((item) =>
    [...item.pose.partes.values()].some((parte) => Math.abs(parte.angulo) > 0.01)
  );
  comprobar(deformados, "con movimiento la pose debería deformarse");
}

// ------------------------------------------------------------
// 2. Salida de una persona
// ------------------------------------------------------------

{
  const reporte = crearReporte("Salida: un organismo se desvanece");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "dos" });

  correr(experiencia, 5);
  comprobar(experiencia.controller.items.length === 2, "arranca con dos");

  // "quieto" deja una sola persona (p0).
  experiencia.mock.setModo("quieto");
  correr(experiencia, 5);

  const items = experiencia.controller.items;
  comprobar(items.length === 1, "debería quedar un solo organismo");
  comprobar(
    items[0].personaId === "p0",
    "el que queda es el de la persona que sigue"
  );
  comprobar(
    experiencia.behaviors.organismos().length === 1,
    "el motor de comportamientos también olvida al que se fue"
  );
}

// ------------------------------------------------------------
// 3. Desaparición total
// ------------------------------------------------------------

{
  const reporte = crearReporte("Desaparición: la persona se va");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "dos" });

  correr(experiencia, 5);

  experiencia.mock.setModo("perdida");
  correr(experiencia, 8);

  comprobar(
    experiencia.controller.items.length === 0,
    "sin personas no debería quedar ningún organismo"
  );
  comprobar(
    experiencia.behaviors.organismos().length === 0,
    "el motor queda vacío"
  );
  comprobar(
    experiencia.controller.eventos.some((evento) => evento.tipo === "desaparecio"),
    "se registró la desaparición"
  );
}

// ------------------------------------------------------------
// 4. Renacimiento con otra identidad
// ------------------------------------------------------------

{
  const reporte = crearReporte("Renacimiento: entra, sale y vuelve");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "entra-y-sale" });

  const ids = new Set();

  correr(experiencia, 16, (actual) => {
    for (const item of actual.controller.items) {
      if (item.personaId === "p0") ids.add(item.organismo.id);
    }
  });

  comprobar(
    ids.size >= 2,
    "al volver, el organismo debería nacer con otra identidad"
  );
  comprobar(
    experiencia.controller.eventos.filter((evento) => evento.tipo === "nacio").length >= 2,
    "se registraron al menos dos nacimientos"
  );
}

// ------------------------------------------------------------
// 5. Un solo organismo también vive
// ------------------------------------------------------------

{
  const reporte = crearReporte("Solitario: un organismo sin pareja");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "lissajous" });

  correr(experiencia, 5);

  const items = experiencia.controller.items;
  comprobar(items.length === 1, "debería haber un organismo");
  comprobar(
    items[0].parejaId === null || items[0].parejaId === "null",
    "sin pareja no hay interacción de a dos"
  );
  comprobar(
    experiencia.controller.distanciaEntrePersonas() === null,
    "sin dos personas no hay distancia"
  );
}

// ------------------------------------------------------------
// 6. Render sin vista y mensajes de estado
// ------------------------------------------------------------

{
  const reporte = crearReporte("Render sin vista");
  const comprobar = comprobarEn(reporte);
  const experiencia = armarExperiencia({ modo: "dos" });

  let fallo = null;
  try {
    correr(experiencia, 2);
    experiencia.controller.render();
  } catch (error) {
    fallo = error;
  }

  comprobar(fallo === null, `render sin vista no debería fallar: ${fallo?.message ?? ""}`);
  comprobar(
    experiencia.controller.estado("cargando modelo…") === experiencia.controller,
    "estado() devuelve el controller para encadenar"
  );
  comprobar(
    experiencia.controller.mensaje === "cargando modelo…",
    "el HUD recibe el mensaje de estado"
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
