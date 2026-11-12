#!/usr/bin/env node
// ============================================================
// tests/verificar-paletas.mjs
//
// Pruebas de las paletas cromáticas.
// Sin dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-paletas.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
// ============================================================

import { FamilyRegistry } from "../src/model/FamilyRegistry.js";
import { createGenome } from "../src/model/genome/createGenome.js";
import { bornOrganism } from "../src/model/genome/bornOrganism.js";
import { PaletteRegistry } from "../src/model/palette/PaletteRegistry.js";
import {
  CONTRASTE_MINIMO,
  FONDOS_DE_PRUEBA,
  createPalette,
} from "../src/model/palette/createPalette.js";
import { contrasteConFondo } from "../src/model/palette/color.js";

// ------------------------------------------------------------
// Mini framework
// ------------------------------------------------------------

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

const familiasAnatomicas = FamilyRegistry.listFamilies();
const paletas = PaletteRegistry.listPalettes();
const SEMILLAS = 1000;

/** Distancia entre dos tonos, teniendo en cuenta que la rueda da vueltas. */
function distanciaDeTono(a, b) {
  const diferencia = Math.abs(a - b) % 360;
  return Math.min(diferencia, 360 - diferencia);
}

// Límites que declara el modelo.
const LIMITES = {
  base: { sMin: 45, sMax: 100, lMin: 52, lMax: 82 },
  acento: { sMin: 45, sMax: 100, lMin: 52, lMax: 82 },
  claro: { sMin: 60, sMax: 95, lMin: 84, lMax: 94 },
  oscuro: { sMin: 40, sMax: 90, lMin: 26, lMax: 36 },
  halo: { sMin: 40, sMax: 95, lMin: 72, lMax: 82, aMin: 0.18, aMax: 0.3 },
};

// Variación máxima permitida alrededor del ancla.
const VARIACION_DE_TONO = 8;
const MARGEN_DE_REDONDEO = 0.6;

// ------------------------------------------------------------
// 1. Misma semilla, misma paleta
// ------------------------------------------------------------

{
  const reporte = crearReporte("Misma semilla, misma paleta");
  const comprobar = comprobarEn(reporte);

  for (const familia of familiasAnatomicas) {
    const a = createPalette(familia.id, 4242);
    const b = createPalette(familia.id, 4242);

    comprobar(
      JSON.stringify(a) === JSON.stringify(b),
      `${familia.id}: la paleta cambia entre dos creaciones con la misma semilla`
    );

    const c = createPalette(familia.id, 4243);
    comprobar(
      JSON.stringify(a.colors) !== JSON.stringify(c.colors),
      `${familia.id}: semillas distintas dieron la misma paleta`
    );
  }
}

// ------------------------------------------------------------
// 2. Congelada
// ------------------------------------------------------------

{
  const reporte = crearReporte("Paleta congelada");
  const comprobar = comprobarEn(reporte);

  const paleta = createPalette("abanico-extremidades", 99);

  comprobar(Object.isFrozen(paleta), "la paleta no está congelada");
  comprobar(Object.isFrozen(paleta.colors), "los colores no están congelados");
  comprobar(Object.isFrozen(paleta.colors.base), "el color base no está congelado");

  const tonoOriginal = paleta.colors.base.h;
  try {
    paleta.colors.base.h = 0;
    paleta.colors.base = null;
  } catch {
    /* en modo estricto tira error: también está bien */
  }

  comprobar(paleta.colors.base.h === tonoOriginal, "se pudo cambiar el tono de la paleta");
}

// ------------------------------------------------------------
// 3. 1000 semillas: rangos y contraste
// ------------------------------------------------------------

{
  const reporte = crearReporte(`${SEMILLAS} semillas por familia anatómica`);
  const comprobar = comprobarEn(reporte);

  const problemas = [];

  for (const familia of familiasAnatomicas) {
    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const paleta = createPalette(familia.id, semilla);

      // Rangos por rol
      for (const [rol, limites] of Object.entries(LIMITES)) {
        const color = paleta.colors[rol];

        if (color.s < limites.sMin || color.s > limites.sMax) {
          problemas.push(`semilla ${semilla}: ${rol} saturación ${color.s}`);
        }
        if (color.l < limites.lMin || color.l > limites.lMax) {
          problemas.push(`semilla ${semilla}: ${rol} luminosidad ${color.l}`);
        }
        if (limites.aMin !== undefined && (color.a < limites.aMin || color.a > limites.aMax)) {
          problemas.push(`semilla ${semilla}: ${rol} alfa ${color.a}`);
        }
      }

      // Contraste de la tríada en los tres fondos
      for (const fondo of FONDOS_DE_PRUEBA) {
        const mejor = Math.max(
          contrasteConFondo(paleta.colors.claro, fondo.rgb),
          contrasteConFondo(paleta.colors.base, fondo.rgb),
          contrasteConFondo(paleta.colors.oscuro, fondo.rgb)
        );

        if (mejor < CONTRASTE_MINIMO) {
          problemas.push(
            `semilla ${semilla}: contraste ${mejor.toFixed(2)} contra fondo ${fondo.nombre}`
          );
        }
      }
    }
  }

  comprobar(
    problemas.length === 0,
    `${problemas.length} problemas -> ${problemas.slice(0, 3).join(" | ")}`
  );
}

// ------------------------------------------------------------
// 4. Fidelidad a los SVG
// ------------------------------------------------------------

{
  const reporte = crearReporte("Fidelidad de tono a los SVG");
  const comprobar = comprobarEn(reporte);

  const problemas = [];

  for (const familia of familiasAnatomicas) {
    const ancla = PaletteRegistry.paletaParaFamilia(familia.id);

    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const paleta = createPalette(familia.id, semilla);

      const distanciaBase = distanciaDeTono(paleta.colors.base.h, ancla.base.h);
      const distanciaAcento = distanciaDeTono(paleta.colors.acento.h, ancla.acento.h);

      if (distanciaBase > VARIACION_DE_TONO + MARGEN_DE_REDONDEO) {
        problemas.push(
          `semilla ${semilla}: base a ${distanciaBase.toFixed(1)}° del ancla (${ancla.base.h}°)`
        );
      }

      if (distanciaAcento > VARIACION_DE_TONO + MARGEN_DE_REDONDEO) {
        problemas.push(
          `semilla ${semilla}: acento a ${distanciaAcento.toFixed(1)}° del ancla (${ancla.acento.h}°)`
        );
      }
    }
  }

  comprobar(
    problemas.length === 0,
    `${problemas.length} problemas -> ${problemas.slice(0, 3).join(" | ")}`
  );
}

// ------------------------------------------------------------
// 5. Proporción de familias de paleta
// ------------------------------------------------------------

{
  const reporte = crearReporte("Proporción de familias de paleta");
  const comprobar = comprobarEn(reporte);

  const conteo = new Map();

  for (let semilla = 0; semilla < SEMILLAS; semilla++) {
    const organismo = bornOrganism(semilla);
    const id = organismo.palette.familyId;
    conteo.set(id, (conteo.get(id) ?? 0) + 1);
  }

  for (const paleta of paletas) {
    const proporcion = (conteo.get(paleta.id) ?? 0) / SEMILLAS;
    comprobar(
      proporcion >= 0.15,
      `la paleta "${paleta.id}" apareció en ${(proporcion * 100).toFixed(1)}% de las semillas`
    );
  }
}

// ------------------------------------------------------------
// 6. Variedad
// ------------------------------------------------------------

{
  const reporte = crearReporte("Variedad de paletas");
  const comprobar = comprobarEn(reporte);

  const distintas = new Set(
    Array.from({ length: 100 }, (_, semilla) =>
      JSON.stringify(createPalette("abanico-extremidades", semilla).colors)
    )
  );

  comprobar(distintas.size === 100, `de 100 semillas salieron ${distintas.size} paletas distintas`);
}

// ------------------------------------------------------------
// 7. La anatomía no cambia por agregar la paleta
// ------------------------------------------------------------

{
  const reporte = crearReporte("La anatomía no cambia");
  const comprobar = comprobarEn(reporte);

  for (const familia of familiasAnatomicas) {
    const antes = createGenome(familia, 7);
    createPalette(familia.id, 7);
    const despues = createGenome(familia, 7);

    comprobar(
      JSON.stringify(antes.parts) === JSON.stringify(despues.parts),
      `${familia.id}: el genoma cambió después de crear la paleta`
    );
  }

  // El genoma dentro del organismo es exactamente el que genera createGenome.
  for (const semilla of [1, 8, 77, 555]) {
    const organismo = bornOrganism(semilla);
    const familia = FamilyRegistry.getFamily(organismo.familyId);

    comprobar(
      JSON.stringify(organismo.genome.parts) ===
        JSON.stringify(createGenome(familia, organismo.seed).parts),
      `semilla ${semilla}: el genoma del organismo no coincide con createGenome`
    );
  }
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
  console.log(`TODO OK — ${paletas.length} paletas · ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
