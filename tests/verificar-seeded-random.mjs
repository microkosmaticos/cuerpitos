#!/usr/bin/env node
// ============================================================
// tests/verificar-seeded-random.mjs
//
// Pruebas del generador pseudoaleatorio con semilla.
// Sin dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-seeded-random.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
// ============================================================

import { SeededRandom } from "../src/model/random/SeededRandom.js";

// ------------------------------------------------------------
// Mini framework, igual estilo que verificar-familias.mjs
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

function esperarError(fn, mensaje, comprobar) {
  try {
    fn();
    comprobar(false, `${mensaje}: debería haber tirado un error`);
  } catch {
    comprobar(true, mensaje);
  }
}

// ------------------------------------------------------------
// Reproducibilidad
// ------------------------------------------------------------

{
  const reporte = crearReporte("Misma semilla, misma secuencia");
  const comprobar = comprobarEn(reporte);

  const a = new SeededRandom(123);
  const b = new SeededRandom(123);

  const secuenciaA = Array.from({ length: 50 }, () => a.next());
  const secuenciaB = Array.from({ length: 50 }, () => b.next());

  comprobar(
    JSON.stringify(secuenciaA) === JSON.stringify(secuenciaB),
    "dos generadores con la misma semilla dieron secuencias distintas"
  );

  const c = new SeededRandom(124);
  const primeraC = c.next();
  comprobar(secuenciaA[0] !== primeraC, "semillas distintas dieron el mismo primer número");

  // Una semilla numérica y el mismo número como texto deben ser equivalentes
  // (sirve para leer ?seed=123 de la URL).
  const desdeNumero = new SeededRandom(42);
  const desdeTexto = new SeededRandom("42");
  comprobar(
    desdeNumero.next() === desdeTexto.next(),
    "la semilla 42 y la semilla \"42\" no dieron el mismo número"
  );

  // Dos generadores no se pisan el estado entre sí.
  const x = new SeededRandom(7);
  const y = new SeededRandom(7);
  x.next();
  x.next();
  comprobar(
    y.next() === new SeededRandom(7).next(),
    "un generador alteró el estado de otro"
  );
}

// ------------------------------------------------------------
// next()
// ------------------------------------------------------------

{
  const reporte = crearReporte("next()");
  const comprobar = comprobarEn(reporte);
  const rng = new SeededRandom(2026);

  let dentroDeRango = true;
  let suma = 0;
  const cantidad = 10000;

  for (let i = 0; i < cantidad; i++) {
    const valor = rng.next();
    if (!(valor >= 0 && valor < 1)) dentroDeRango = false;
    suma += valor;
  }

  comprobar(dentroDeRango, "next() devolvió algún valor fuera de [0, 1)");

  const promedio = suma / cantidad;
  comprobar(
    promedio > 0.45 && promedio < 0.55,
    `el promedio de 10000 valores fue ${promedio.toFixed(4)}, fuera de 0.45–0.55`
  );
}

// ------------------------------------------------------------
// range()
// ------------------------------------------------------------

{
  const reporte = crearReporte("range()");
  const comprobar = comprobarEn(reporte);
  const rng = new SeededRandom(99);

  let minimoVisto = Infinity;
  let maximoVisto = -Infinity;
  let dentroDeRango = true;

  for (let i = 0; i < 10000; i++) {
    const valor = rng.range(10, 20);
    if (!(valor >= 10 && valor <= 20)) dentroDeRango = false;
    minimoVisto = Math.min(minimoVisto, valor);
    maximoVisto = Math.max(maximoVisto, valor);
  }

  comprobar(dentroDeRango, "range(10, 20) devolvió un valor fuera del rango");
  comprobar(
    minimoVisto < 10.2 && maximoVisto > 19.8,
    `range(10, 20) no cubre el rango completo (min ${minimoVisto.toFixed(2)}, max ${maximoVisto.toFixed(2)})`
  );

  comprobar(new SeededRandom(1).range(5, 5) === 5, "range(5, 5) debería devolver 5");

  esperarError(
    () => new SeededRandom(1).range(20, 10),
    "range() con máximo menor que el mínimo",
    comprobar
  );
  esperarError(
    () => new SeededRandom(1).range(0, NaN),
    "range() con NaN",
    comprobar
  );
}

// ------------------------------------------------------------
// int()
// ------------------------------------------------------------

{
  const reporte = crearReporte("int()");
  const comprobar = comprobarEn(reporte);
  const rng = new SeededRandom(7);

  const vistos = new Set();
  let todosEnteros = true;
  let dentroDeRango = true;

  for (let i = 0; i < 2000; i++) {
    const valor = rng.int(1, 6);
    if (!Number.isInteger(valor)) todosEnteros = false;
    if (valor < 1 || valor > 6) dentroDeRango = false;
    vistos.add(valor);
  }

  comprobar(todosEnteros, "int() devolvió un valor con decimales");
  comprobar(dentroDeRango, "int(1, 6) devolvió un valor fuera de 1–6");
  comprobar(vistos.size === 6, `int(1, 6) no llegó a los 6 valores, llegó a ${vistos.size}`);
  comprobar([...vistos].every((v) => v >= 1 && v <= 6), "int() devolvió un valor fuera de 1–6");

  comprobar(new SeededRandom(1).int(3, 3) === 3, "int(3, 3) debería devolver 3");

  esperarError(
    () => new SeededRandom(1).int(1.5, 3),
    "int() con un mínimo decimal",
    comprobar
  );
  esperarError(
    () => new SeededRandom(1).int(5, 2),
    "int() con máximo menor que el mínimo",
    comprobar
  );
}

// ------------------------------------------------------------
// pick()
// ------------------------------------------------------------

{
  const reporte = crearReporte("pick()");
  const comprobar = comprobarEn(reporte);

  const lista = ["rojo", "verde", "azul"];

  const a = new SeededRandom(5);
  const b = new SeededRandom(5);

  const eleccionesA = Array.from({ length: 30 }, () => a.pick(lista));
  const eleccionesB = Array.from({ length: 30 }, () => b.pick(lista));

  comprobar(
    JSON.stringify(eleccionesA) === JSON.stringify(eleccionesB),
    "pick() no es reproducible con la misma semilla"
  );
  comprobar(
    eleccionesA.every((valor) => lista.includes(valor)),
    "pick() devolvió un elemento que no estaba en la lista"
  );
  comprobar(
    new Set(eleccionesA).size === 3,
    "pick() nunca eligió alguno de los elementos de la lista"
  );

  esperarError(() => new SeededRandom(1).pick([]), "pick() con lista vacía", comprobar);
  esperarError(() => new SeededRandom(1).pick("texto"), "pick() con algo que no es lista", comprobar);
}

// ------------------------------------------------------------
// Semillas inválidas
// ------------------------------------------------------------

{
  const reporte = crearReporte("Semillas inválidas");
  const comprobar = comprobarEn(reporte);

  esperarError(() => new SeededRandom("abc"), "semilla no numérica", comprobar);
  esperarError(() => new SeededRandom(undefined), "semilla undefined", comprobar);
  esperarError(() => new SeededRandom(NaN), "semilla NaN", comprobar);

  // Semillas negativas o con decimales se normalizan, no fallan.
  comprobar(
    new SeededRandom(-5).next() === new SeededRandom(5).next(),
    "una semilla negativa debería normalizarse igual que su valor absoluto"
  );
  comprobar(
    new SeededRandom(5.9).next() === new SeededRandom(5).next(),
    "una semilla con decimales debería normalizarse hacia abajo"
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
  console.log(`TODO OK — ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
