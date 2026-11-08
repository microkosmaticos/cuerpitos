#!/usr/bin/env node
// ============================================================
// tests/verificar-ciclo.mjs
//
// Pruebas del ciclo de vida: nacimiento, vida y desaparición.
// Sin dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-ciclo.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
// ============================================================

import fs from "node:fs";
import path from "node:path";

import { OrganismManager, PASO_FIJO } from "../src/model/lifecycle/OrganismManager.js";
import { ESTADOS } from "../src/model/lifecycle/estados.js";
import { CICLO } from "../src/config/ciclo.js";

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

// ------------------------------------------------------------
// Ayudas
// ------------------------------------------------------------

/** Persona válida con los dos hombros visibles. */
function persona(id = "p0", { presente = true, x = 0.5, y = 0.5, confianza = 0.95, separacion = 0.3 } = {}) {
  return {
    id,
    present: presente,
    confidence: confianza,
    center: { x, y },
    energy: 0.6,
    spread: 0.6,
    anchors: [
      { x: x - separacion / 2, y: y - 0.1, vx: 0, vy: 0, confidence: 0.9 },
      { x: x + separacion / 2, y: y - 0.1, vx: 0, vy: 0, confidence: 0.9 },
      null,
      null,
      null,
      null,
      null,
    ],
  };
}

function frameDe(personas) {
  return { timestamp: 0, persons: personas };
}

/** Fuente de semillas determinista para las pruebas. */
function fuenteDeSemillas(desde = 1000) {
  let siguiente = desde;
  return () => {
    const semilla = siguiente;
    siguiente += 1;
    return semilla;
  };
}

/** Corre el gestor durante `segundos` con un frame por paso. */
function correr(gestor, frame, dt, segundos) {
  const pasos = Math.round(segundos / dt);
  const eventos = [];
  let ultimo = null;

  for (let i = 0; i < pasos; i++) {
    ultimo = gestor.update(dt, frame);
    eventos.push(...ultimo.eventos);
  }

  return { ultimo, eventos };
}

function primerEvento(eventos, tipo) {
  return eventos.find((evento) => evento.tipo === tipo);
}

// ------------------------------------------------------------
// 1. Confirmación
// ------------------------------------------------------------

{
  const reporte = crearReporte("Confirmación");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas() });
  const frame = frameDe([persona("p0")]);

  const corto = correr(gestor, frame, 1 / 60, 0.5);
  comprobar(
    corto.ultimo.organismos.length === 0,
    "0.5 s de persona válida no debería alcanzar para nacer"
  );

  const largo = correr(gestor, frame, 1 / 60, 0.3);
  comprobar(
    largo.ultimo.organismos.length === 1,
    "pasada la confirmación debería nacer un organismo"
  );
}

// ------------------------------------------------------------
// 2. Gracia
// ------------------------------------------------------------

{
  const reporte = crearReporte("Gracia");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(2000) });
  const valido = frameDe([persona("p0")]);

  const nacimiento = correr(gestor, valido, 1 / 60, CICLO.confirmacion + CICLO.nacimiento + 0.1);
  const semillaInicial = nacimiento.ultimo.organismos[0]?.organismo.seed;

  comprobar(
    nacimiento.ultimo.organismos[0]?.estado === ESTADOS.VIVO,
    `debería estar vivo y está en ${nacimiento.ultimo.organismos[0]?.estado}`
  );

  // Se va por menos tiempo que la gracia.
  const ausente = frameDe([persona("p0", { presente: false })]);
  const corte = correr(gestor, ausente, 1 / 60, CICLO.gracia - 0.2);

  comprobar(
    corte.ultimo.organismos.length === 1,
    "una ausencia corta no debería eliminar el organismo"
  );
  comprobar(
    corte.ultimo.organismos[0].estado === ESTADOS.VIVO,
    `sigue vivo y está en ${corte.ultimo.organismos[0]?.estado}`
  );
  comprobar(
    corte.ultimo.organismos[0].organismo.seed === semillaInicial,
    "el organismo debería conservar la semilla"
  );
  comprobar(
    !primerEvento(corte.eventos, "empezo-a-desvanecerse"),
    "no debería haber empezado a desvanecerse"
  );
}

// ------------------------------------------------------------
// 3. Desaparición exacta
// ------------------------------------------------------------

{
  const reporte = crearReporte("Desaparición exacta");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(3000) });
  const valido = frameDe([persona("p0")]);

  const nacimiento = correr(gestor, valido, 1 / 60, CICLO.confirmacion + CICLO.nacimiento + 0.2);
  const eventosDelNacimiento = nacimiento.eventos;

  const ausente = frameDe([persona("p0", { presente: false })]);

  // Primero la gracia.
  const espera = correr(gestor, ausente, 1 / 60, CICLO.gracia + 0.1);
  comprobar(
    espera.ultimo.organismos[0]?.estado === ESTADOS.DESVANECIENDO,
    `tras la gracia debería desvanecerse y está en ${espera.ultimo.organismos[0]?.estado}`
  );

  // Después la desaparición completa.
  const final = correr(gestor, ausente, 1 / 60, CICLO.desaparicion + 0.1);

  comprobar(final.ultimo.organismos.length === 0, "al terminar debería estar eliminado");
  comprobar(
    Boolean(primerEvento(final.eventos, "desaparecio")),
    "debería haber emitido desaparecio"
  );

  const evento = primerEvento(final.eventos, "desaparecio");
  const nacio = primerEvento(eventosDelNacimiento, "nacio");
  comprobar(Boolean(nacio), "debería haber emitido nacio antes");
  comprobar(
    evento && nacio && evento.organismoId === nacio.organismoId,
    "los eventos deberían ser del mismo organismo"
  );
}

// ------------------------------------------------------------
// 4. Presencia entre 0 y 1
// ------------------------------------------------------------

{
  const reporte = crearReporte("Presencia 0..1");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(4000) });
  const valido = frameDe([persona("p0")]);

  let dentroDeRango = true;
  let subio = true;
  let presenciaAnterior = 0;

  for (let i = 0; i < 200; i++) {
    const resultado = gestor.update(1 / 60, valido);
    const organismo = resultado.organismos[0];
    if (!organismo) continue;

    if (organismo.presencia < 0 || organismo.presencia > 1) dentroDeRango = false;
    if (organismo.presencia < presenciaAnterior - 1e-9) subio = false;
    presenciaAnterior = organismo.presencia;
  }

  comprobar(dentroDeRango, "la presencia se salió de 0..1");
  comprobar(subio, "durante el nacimiento la presencia debería subir");
  comprobar(presenciaAnterior === 1, `al terminar el nacimiento debería ser 1 y es ${presenciaAnterior}`);
}

{
  const reporte = crearReporte("Presencia baja hasta 0");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(5000) });
  correr(gestor, frameDe([persona("p0")]), 1 / 60, CICLO.confirmacion + CICLO.nacimiento + 0.2);

  const ausente = frameDe([persona("p0", { presente: false })]);
  correr(gestor, ausente, 1 / 60, CICLO.gracia + 0.1);

  let bajo = true;
  let anterior = 1;

  for (let i = 0; i < 200; i++) {
    const resultado = gestor.update(1 / 60, ausente);
    const organismo = resultado.organismos[0];
    if (!organismo) break;
    if (organismo.presencia > anterior + 1e-9) bajo = false;
    anterior = organismo.presencia;
  }

  comprobar(bajo, "durante la desaparición la presencia debería bajar");
  comprobar(gestor.espacios.length === 0, "al final se elimina");
}

// ------------------------------------------------------------
// 5. Regresos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Regreso después de desaparecer");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(6000) });
  const valido = frameDe([persona("p0")]);

  correr(gestor, valido, 1 / 60, CICLO.confirmacion + CICLO.nacimiento + 0.1);
  const primeraSemilla = gestor.espacios[0].organismo.seed;

  const ausente = frameDe([persona("p0", { presente: false })]);
  correr(gestor, ausente, 1 / 60, CICLO.gracia + CICLO.desaparicion + 0.2);

  comprobar(gestor.espacios.length === 0, "debería haber desaparecido");

  const regreso = correr(gestor, valido, 1 / 60, CICLO.confirmacion + 0.1);
  const nuevaSemilla = regreso.ultimo.organismos[0]?.organismo.seed;

  comprobar(Boolean(nuevaSemilla), "debería nacer uno nuevo");
  comprobar(nuevaSemilla !== primeraSemilla, "la semilla debería ser distinta");
}

{
  const reporte = crearReporte("Regreso durante el desvanecimiento");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(7000) });
  const valido = frameDe([persona("p0")]);

  correr(gestor, valido, 1 / 60, CICLO.confirmacion + CICLO.nacimiento + 0.1);
  const idViejo = gestor.espacios[0].organismo.id;
  const semillaVieja = gestor.espacios[0].organismo.seed;

  // Se va y vuelve a mitad del desvanecimiento.
  const ausente = frameDe([persona("p0", { presente: false })]);
  correr(gestor, ausente, 1 / 60, CICLO.gracia + CICLO.desaparicion / 2);

  const volvio = correr(gestor, valido, 1 / 60, CICLO.confirmacion + 0.2);

  const viejo = volvio.ultimo.organismos.find((item) => item.organismo.id === idViejo);
  comprobar(Boolean(viejo), "el organismo viejo debería seguir desvaneciéndose");
  comprobar(
    viejo.estado === ESTADOS.DESVANECIENDO,
    `el viejo debería estar desvaneciéndose y está en ${viejo?.estado}`
  );
  comprobar(viejo.organismo.seed === semillaVieja, "el viejo no debería cambiar de identidad");
}

// ------------------------------------------------------------
// 6. Máximo dos organismos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Máximo dos organismos");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(8000) });

  const tres = frameDe([
    persona("p0", { x: 0.3 }),
    persona("p1", { x: 0.6 }),
    persona("p2", { x: 0.8 }),
  ]);

  const resultado = correr(gestor, tres, 1 / 60, 3);

  comprobar(
    resultado.ultimo.organismos.length === 2,
    `deberían ser 2 organismos y son ${resultado.ultimo.organismos.length}`
  );
  comprobar(
    resultado.ultimo.pendientes.every((pendiente) => pendiente.personaId !== "p2"),
    "la tercera persona debería ignorarse"
  );
}

// ------------------------------------------------------------
// 7. Genoma y paleta intactos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Genoma y paleta congelados");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9000) });
  correr(gestor, frameDe([persona("p0")]), 1 / 60, CICLO.confirmacion + 0.1);

  const organismo = gestor.espacios[0].organismo;
  const genomaAlNacer = JSON.stringify(organismo.genome);
  const paletaAlNacer = JSON.stringify(organismo.palette);

  correr(gestor, frameDe([persona("p0")]), 1 / 60, CICLO.nacimiento + 0.5);

  comprobar(Object.isFrozen(organismo.genome), "el genoma debería estar congelado");
  comprobar(Object.isFrozen(organismo.palette), "la paleta debería estar congelada");
  comprobar(
    JSON.stringify(organismo.genome) === genomaAlNacer,
    "el genoma cambió durante el ciclo"
  );
  comprobar(
    JSON.stringify(organismo.palette) === paletaAlNacer,
    "la paleta cambió durante el ciclo"
  );
}

// ------------------------------------------------------------
// 8. 30 y 60 fps
// ------------------------------------------------------------

{
  const reporte = crearReporte("30 y 60 fps equivalentes");
  const comprobar = comprobarEn(reporte);

  const correrCon = (dt) => {
    const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9200) });
    const frame = frameDe([persona("p0")]);
    const pasos = Math.round(4 / dt);
    let ultimo = null;
    for (let i = 0; i < pasos; i++) ultimo = gestor.update(dt, frame);
    return ultimo.organismos[0];
  };

  const a30 = correrCon(1 / 30);
  const a60 = correrCon(1 / 60);

  const diferencia = Math.abs(a30.presencia - a60.presencia);
  comprobar(
    diferencia <= PASO_FIJO / CICLO.nacimiento + 1e-9,
    `la presencia difiere ${diferencia.toFixed(4)} entre 30 y 60 fps`
  );
  comprobar(a30.estado === a60.estado, `los estados difieren: ${a30.estado} vs ${a60.estado}`);
}

// ------------------------------------------------------------
// 9. Mismos frames, mismos eventos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Eventos deterministas");
  const comprobar = comprobarEn(reporte);

  const escenario = (gestor) => {
    const eventos = [];
    let ultimo;

    for (let i = 0; i < 60; i++) {
      ultimo = gestor.update(1 / 60, frameDe([persona("p0")]));
      eventos.push(...ultimo.eventos);
    }
    for (let i = 0; i < 400; i++) {
      ultimo = gestor.update(1 / 60, frameDe([persona("p0", { presente: false })]));
      eventos.push(...ultimo.eventos);
    }

    return eventos;
  };

  const uno = escenario(new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9400) }));
  const dos = escenario(new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9400) }));

  comprobar(
    JSON.stringify(uno) === JSON.stringify(dos),
    "dos gestores con la misma fuente y los mismos frames dieron eventos distintos"
  );
}

// ------------------------------------------------------------
// 10. Dos personas independientes
// ------------------------------------------------------------

{
  const reporte = crearReporte("Dos personas independientes");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9600) });

  correr(gestor, frameDe([persona("p0", { x: 0.3 }), persona("p1", { x: 0.7 })]), 1 / 60, 3);

  const antes = gestor.espacios.map((espacio) => espacio.organismo.id);
  comprobar(antes.length === 2, "deberían ser dos organismos");

  // Se va p0; p1 se queda.
  const resultado = correr(
    gestor,
    frameDe([persona("p0", { x: 0.3, presente: false }), persona("p1", { x: 0.7 })]),
    1 / 60,
    CICLO.gracia + 0.2
  );

  const p1 = resultado.ultimo.organismos.find((item) => item.personaId === "p1");
  comprobar(Boolean(p1), "la persona que se queda debería conservar su organismo");
  comprobar(p1.estado === ESTADOS.VIVO, `p1 debería seguir vivo y está en ${p1?.estado}`);
  comprobar(p1.presencia === 1, "p1 debería tener presencia 1");
}

// ------------------------------------------------------------
// 11. Sin Math.random en el modelo
// ------------------------------------------------------------

{
  const reporte = crearReporte("Sin Math.random en el modelo");
  const comprobar = comprobarEn(reporte);

  const permitido = path.join("src", "model", "genome", "bornOrganism.js");
  const encontrados = [];

  const recorrer = (carpeta) => {
    for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = path.join(carpeta, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (!entrada.name.endsWith(".js")) continue;

      const contenido = fs.readFileSync(ruta, "utf8");

      // Se ignoran los comentarios: hablan de Math.random sin usarlo.
      const codigo = contenido
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      if (codigo.includes("Math.random")) encontrados.push(ruta);
    }
  };

  recorrer(path.join("src", "model"));

  comprobar(
    encontrados.every((ruta) => ruta === permitido),
    `Math.random aparece en: ${encontrados.join(", ")}`
  );
  comprobar(encontrados.includes(permitido), "bornOrganism debería ser el único con Math.random");
}

// ------------------------------------------------------------
// 12. Eventos: una vez y en orden
// ------------------------------------------------------------

{
  const reporte = crearReporte("Eventos una vez y en orden");
  const comprobar = comprobarEn(reporte);

  const gestor = new OrganismManager({ fuenteDeSemillas: fuenteDeSemillas(9800) });
  const eventos = [];

  for (let i = 0; i < 60; i++) eventos.push(...gestor.update(1 / 60, frameDe([persona("p0")])).eventos);
  for (let i = 0; i < 400; i++) {
    eventos.push(...gestor.update(1 / 60, frameDe([persona("p0", { presente: false })])).eventos);
  }

  const tipos = eventos.map((evento) => evento.tipo);
  const unicos = new Set(eventos.map((evento) => `${evento.tipo}:${evento.organismoId}`));

  comprobar(tipos.length === 3, `debería haber 3 eventos y hay ${tipos.length}: ${tipos.join(", ")}`);
  comprobar(unicos.size === tipos.length, "algún evento se repitió");
  comprobar(
    tipos[0] === "nacio" &&
      tipos[1] === "empezo-a-desvanecerse" &&
      tipos[2] === "desaparecio",
    `orden incorrecto: ${tipos.join(" → ")}`
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
