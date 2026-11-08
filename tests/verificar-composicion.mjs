#!/usr/bin/env node
// ============================================================
// tests/verificar-composicion.mjs
//
// Comprueba que la COMPOSICIÓN ORIGINAL se respete:
//   1. Las piezas del dibujo (marcadas con "origen") quedan en el
//      lugar donde estaban en el SVG, escaladas junto con el torso.
//   2. Las piezas extra se separan al menos lo mínimo garantizado.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-composicion.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
// ============================================================

import { FamilyRegistry } from "../src/model/FamilyRegistry.js";
import { createGenome, SEPARACION_GARANTIZADA } from "../src/model/genome/createGenome.js";
import { construirForma } from "../src/model/families/canonical.js";
import { getSilueta } from "../src/model/families/silhouettes.js";
import { bornOrganism } from "../src/model/genome/bornOrganism.js";
import { mostrarParte } from "../src/config/visual.js";

const familiasAnatomicas = FamilyRegistry.listFamilies();

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

const SEMILLAS = 1000;
const TOLERANCIA = 0.5;

function cajaDe(puntos) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const punto of puntos) {
    if (punto.x < minX) minX = punto.x;
    if (punto.y < minY) minY = punto.y;
    if (punto.x > maxX) maxX = punto.x;
    if (punto.y > maxY) maxY = punto.y;
  }

  return { width: maxX - minX, height: maxY - minY };
}

function distanciaAngular(a, b) {
  const diferencia = Math.abs(a - b) % 360;
  return Math.min(diferencia, 360 - diferencia);
}

for (const familia of FamilyRegistry.listFamilies()) {
  const reporte = crearReporte(familia.name);
  const comprobar = comprobarEn(reporte);

  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((c) => [c.child, c]));
  const slotNucleo = familia.slots.find((slot) => slot.role === "nucleo");

  const problemasDePosicion = [];
  const problemasDeSeparacion = [];

  for (let semilla = 0; semilla < SEMILLAS; semilla++) {
    const genoma = createGenome(familia, semilla);
    const forma = construirForma(familia, genoma.parts);

    const construidasPorId = new Map(forma.parts.map((parte) => [parte.id, parte]));
    const torso = construidasPorId.get(slotNucleo.id);

    // Escala del torso respecto del dibujo original.
    const cajaTorso = cajaDe(torso.points);
    const tamanoOriginal = getSilueta(slotNucleo.silhouette).tamano;
    const escalaX = cajaTorso.width / tamanoOriginal.width;
    const escalaY = cajaTorso.height / tamanoOriginal.height;

    // 1. Las piezas originales conservan su posición relativa.
    for (const parte of forma.parts) {
      const slot = slotsPorId.get(parte.id);
      if (!slot?.origen || !slot.silhouette) continue;
      if (conexionPorHijo.get(parte.id)?.parent !== "nucleo") continue;

      const home = getSilueta(slot.silhouette).home;
      const esperadoX = home.x * escalaX;
      const esperadoY = home.y * escalaY;

      const errorX = Math.abs(parte.origen.x - esperadoX);
      const errorY = Math.abs(parte.origen.y - esperadoY);

      // Tolerancia relativa al tamaño del torso.
      const toleranciaX = TOLERANCIA + Math.abs(esperadoX) * 0.001;
      const toleranciaY = TOLERANCIA + Math.abs(esperadoY) * 0.001;

      if (errorX > toleranciaX || errorY > toleranciaY) {
        problemasDePosicion.push(
          `semilla ${semilla}: ${parte.id} en (${parte.origen.x.toFixed(1)}, ${parte.origen.y.toFixed(1)}) y se esperaba (${esperadoX.toFixed(1)}, ${esperadoY.toFixed(1)})`
        );
      }
    }

    // 2. Las piezas que salen del torso respetan la separación mínima.
    const raices = forma.parts.filter(
      (parte) => conexionPorHijo.get(parte.id)?.parent === "nucleo" && parte.role !== "cabeza"
    );

    for (let i = 0; i < raices.length; i++) {
      for (let j = i + 1; j < raices.length; j++) {
        const anguloA = genoma.parts.find((p) => p.slotId === raices[i].id)?.angle;
        const anguloB = genoma.parts.find((p) => p.slotId === raices[j].id)?.angle;

        if (typeof anguloA !== "number" || typeof anguloB !== "number") continue;

        const distancia = distanciaAngular(anguloA, anguloB);
        if (distancia < SEPARACION_GARANTIZADA - 0.5) {
          problemasDeSeparacion.push(
            `semilla ${semilla}: ${raices[i].id} y ${raices[j].id} a ${distancia.toFixed(1)}°`
          );
        }
      }
    }
  }

  comprobar(
    problemasDePosicion.length === 0,
    `${problemasDePosicion.length} piezas originales fuera de lugar -> ${problemasDePosicion.slice(0, 3).join(" | ")}`
  );

  comprobar(
    problemasDeSeparacion.length === 0,
    `${problemasDeSeparacion.length} pares demasiado juntos -> ${problemasDeSeparacion.slice(0, 3).join(" | ")}`
  );
}

// ------------------------------------------------------------
// Las partes dibujadas conservan lo que el dibujo tenía
// ------------------------------------------------------------

{
  const reporte = crearReporte("Antebrazos dibujados");
  const comprobar = comprobarEn(reporte);

  const problemas = [];

  for (const familia of familiasAnatomicas) {
    const minimo = familia.roles.antebrazo?.min ?? 0;

    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const organismo = bornOrganism(semilla);
      if (organismo.familyId !== familia.id) continue;

      const dibujadas = organismo.shape.parts.filter(mostrarParte);
      const antebrazos = dibujadas.filter((parte) => parte.role === "antebrazo").length;

      if (antebrazos < minimo) {
        problemas.push(
          `semilla ${semilla} (${familia.id}): ${antebrazos} antebrazos dibujados, mínimo ${minimo}`
        );
      }
    }
  }

  comprobar(
    problemas.length === 0,
    `${problemas.length} organismos con menos antebrazos de los que declara su familia -> ${problemas.slice(0, 3).join(" | ")}`
  );
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
  console.log(`TODO OK — ${SEMILLAS} semillas · ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
