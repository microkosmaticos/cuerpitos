#!/usr/bin/env node
// ============================================================
// tests/verificar-comportamientos.mjs
//
// Pruebas del PUENTE de comportamientos: alta/baja de organismos,
// eventos deterministas, progreso, efectos de emoción y limpieza.
//
// Sin navegador: el reloj y el azar se inyectan.
//
//   node tests/verificar-comportamientos.mjs
// ============================================================

import {
  BehaviorBridge,
  PESOS,
} from "../src/behavior/BehaviorBridge.js";
import {
  SocialPacer,
  EMOCIONES_ESPONTANEAS,
} from "../src/behavior/SocialPacer.js";
import { EVENTS, Reacciones } from "../reaccions.js";

/** Pacer inerte: estas pruebas aislan el motor de comportamientos. */
const SIN_PACER = { update() {} };

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

/** Pesos que apagan todos los eventos menos el indicado. */
function soloEvento(eventoId) {
  const pesos = {};
  for (const id of Object.keys(EVENTS)) pesos[id] = 0;
  pesos[eventoId] = 1;
  return pesos;
}

// ------------------------------------------------------------
// 1. Alta y baja
// ------------------------------------------------------------

{
  const reporte = crearReporte("Alta y baja de organismos");
  const comprobar = comprobarEn(reporte);
  let t = 1_000_000;
  const puente = new BehaviorBridge({ ahora: () => t, random: () => 0, pacer: SIN_PACER });

  comprobar(puente.organismos().length === 0, "arranca sin organismos");

  puente.registrar("org-a");
  puente.registrar("org-b");
  comprobar(puente.organismos().length === 2, "registrar agrega organismos");
  comprobar(
    puente.emocionDe("org-a") === "neutral",
    "un organismo nuevo empieza neutral"
  );

  const estado = puente.estadoDe("org-a");
  comprobar(estado.comportamiento === null, "sin evento activo no hay comportamiento");
  comprobar(estado.progreso === 0, "sin evento activo el progreso es 0");
  comprobar(estado.emocion === "neutral", "el estado expone la emoción");

  puente.darDeBaja("org-a");
  comprobar(puente.organismos().length === 1, "dar de baja lo quita del motor");
  comprobar(
    puente.estadoDe("org-a").emocion === "neutral",
    "un organismo desconocido responde neutral"
  );
}

// ------------------------------------------------------------
// 2. Evento individual: progreso y emoción
// ------------------------------------------------------------

{
  const reporte = crearReporte("Evento individual: estirar la extremidad");
  const comprobar = comprobarEn(reporte);
  let t = 2_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0,
    pesos: soloEvento("limb_stretch"),
    pacer: SIN_PACER,
  });

  puente.registrar("org-a");

  t += 10;
  puente.update();

  const inicio = puente.estadoDe("org-a");
  comprobar(
    inicio.comportamiento === "limb_stretch",
    "debería estirar una extremidad desde el estado neutral"
  );
  comprobar(inicio.progreso < 0.05, "el progreso arranca cerca de 0");
  comprobar(inicio.emocion === "neutral", "mientras dura, la emoción no cambió");

  const duracion = EVENTS.limb_stretch.duration[0];

  t += duracion / 2;
  puente.update();
  const mitad = puente.estadoDe("org-a");
  comprobar(
    Math.abs(mitad.progreso - 0.5) < 0.01,
    "a mitad de duración el progreso es 0.5"
  );

  t += duracion;
  puente.update();

  const fin = puente.estadoDe("org-a");
  comprobar(fin.comportamiento === null, "al terminar no queda comportamiento");
  comprobar(fin.progreso === 0, "al terminar el progreso vuelve a 0");
}

{
  const reporte = crearReporte("Evento individual: euforia cambia la emoción");
  const comprobar = comprobarEn(reporte);
  let t = 2_500_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0,
    pesos: soloEvento("euphoric_burst"),
    pacer: SIN_PACER,
  });

  puente.registrar("org-a");
  puente.system.getOrganism("org-a").setEmotion("euphoric");

  t += 10;
  puente.update();
  comprobar(
    puente.estadoDe("org-a").comportamiento === "euphoric_burst",
    "estando eufórico, la explosión es elegible"
  );

  t += EVENTS.euphoric_burst.duration[0] + 10;
  puente.update();
  comprobar(
    puente.estadoDe("org-a").comportamiento === null,
    "la explosión termina"
  );
  comprobar(
    puente.estadoDe("org-a").emocion === "euphoric",
    "el efecto mantiene la emoción eufórica"
  );
}

// ------------------------------------------------------------
// 3. Evento de a dos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Evento de a dos: acercarse");
  const comprobar = comprobarEn(reporte);
  let t = 3_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0,
    pesos: soloEvento("approach"),
    pacer: SIN_PACER,
  });

  puente.registrar("org-a");
  puente.registrar("org-b");

  t += 10;
  puente.update();

  const a = puente.estadoDe("org-a");
  const b = puente.estadoDe("org-b");

  comprobar(a.comportamiento === "approach", "el primero se acerca");
  comprobar(b.comportamiento === "approach", "el segundo también");
  comprobar(a.parejaId === "org-b", "la pareja del primero es el segundo");
  comprobar(b.parejaId === "org-a", "la pareja del segundo es el primero");
}

// ------------------------------------------------------------
// 4. Un solo organismo no inicia eventos de a dos
// ------------------------------------------------------------

{
  const reporte = crearReporte("Sin pareja no hay eventos compartidos");
  const comprobar = comprobarEn(reporte);
  let t = 4_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0,
    pesos: soloEvento("hug"),
    pacer: SIN_PACER,
  });

  puente.registrar("org-a");

  for (let i = 0; i < 30; i++) {
    t += 200;
    puente.update();
  }

  comprobar(
    puente.estadoDe("org-a").comportamiento === null,
    "abrazar necesita dos organismos"
  );
  comprobar(
    puente.estadoDe("org-a").emocion === "neutral",
    "sin evento no hay efecto de emoción"
  );
}

// ------------------------------------------------------------
// 5. Baja durante un evento
// ------------------------------------------------------------

{
  const reporte = crearReporte("Dar de baja durante un evento");
  const comprobar = comprobarEn(reporte);
  let t = 5_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0,
    pesos: soloEvento("shake"),
    pacer: SIN_PACER,
  });

  puente.registrar("org-a");
  puente.system.getOrganism("org-a").setEmotion("fainted");
  t += 10;
  puente.update();
  comprobar(
    puente.estadoDe("org-a").comportamiento === "shake",
    "el evento debería estar activo"
  );

  puente.darDeBaja("org-a");
  t += 100;
  puente.update();

  const estado = puente.estadoDe("org-a");
  comprobar(estado.comportamiento === null, "sin organismo no hay evento");
  comprobar(estado.emocion === "neutral", "sin organismo la emoción es neutral");
  comprobar(puente.organismos().length === 0, "no quedan organismos registrados");
}

// ------------------------------------------------------------
// 5b. Primer encuentro inmediato
// ------------------------------------------------------------

{
  const reporte = crearReporte("Encuentro: se dispara apenas hay dos");
  const comprobar = comprobarEn(reporte);
  let t = 6_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0.5,
    pacer: SIN_PACER,
    pesos: soloEvento("hug"),
  });

  // El motor no podría decidir: su próxima decisión está lejísimos.
  puente.motor._nextDecisionAt = t + 1_000_000;

  puente.registrar("org-a");
  puente.registrar("org-b");

  t += 10;
  puente.update({ distancia: 0.2 });

  const a = puente.estadoDe("org-a");
  const b = puente.estadoDe("org-b");

  comprobar(a.comportamiento === "approach", "debería acercarse en el acto");
  comprobar(b.comportamiento === "approach", "los dos deberían acercarse");
  comprobar(a.parejaId === "org-b", "la pareja debería quedar enlazada");
  comprobar(
    puente.system.getRelationship("org-a", "org-b") === "mutual_love",
    "de cerca, el encuentro debería dejar amor mutuo"
  );
  comprobar(
    puente.emocionDe("org-a") === "attracted",
    "de cerca, uno debería quedar atraído"
  );
  comprobar(
    puente.encuentroHecho === true,
    "el encuentro no debería repetirse en cada cuadro"
  );

  // Termina el acercamiento, pasa el cooldown y sigue el abrazo.
  t += 1100;
  puente.update({ distancia: 0.2 });
  comprobar(
    puente.estadoDe("org-a").comportamiento === null,
    "el acercamiento debería terminar"
  );

  t += 2100;
  puente.update({ distancia: 0.2 });
  comprobar(
    puente.estadoDe("org-a").comportamiento === "hug",
    `después del encuentro debería venir el abrazo y vino ${puente.estadoDe("org-a").comportamiento}`
  );
  comprobar(
    puente.estadoDe("org-a").progreso < 0.1,
    "el abrazo debería arrancar recién"
  );
}

{
  const reporte = crearReporte("Encuentro: lejos es conflicto");
  const comprobar = comprobarEn(reporte);
  let t = 7_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0.5,
    pacer: SIN_PACER,
    pesos: soloEvento("punch"),
  });

  puente.registrar("org-a");
  puente.registrar("org-b");

  t += 10;
  puente.update({ distancia: 0.9 });

  comprobar(
    puente.system.getRelationship("org-a", "org-b") === "conflict",
    "de lejos, el encuentro debería dejar conflicto"
  );
  comprobar(
    puente.estadoDe("org-a").comportamiento === "approach",
    "igual debería haber un primer acercamiento"
  );

  t += 1100;
  puente.update({ distancia: 0.9 });
  t += 2100;
  puente.update({ distancia: 0.9 });

  comprobar(
    puente.estadoDe("org-a").comportamiento === "punch",
    `en conflicto debería venir el golpe y vino ${puente.estadoDe("org-a").comportamiento}`
  );
}

{
  const reporte = crearReporte("Encuentro: uno solo no dispara nada");
  const comprobar = comprobarEn(reporte);
  let t = 8_000_000;
  const puente = new BehaviorBridge({
    ahora: () => t,
    random: () => 0.5,
    pacer: SIN_PACER,
    pesos: soloEvento("approach"),
  });

  puente.registrar("org-a");
  t += 10;
  puente.update({ distancia: null });

  comprobar(
    puente.encuentroHecho === false,
    "con un solo organismo no debería haber encuentro"
  );
  comprobar(
    puente.estadoDe("org-a").comportamiento === null,
    "tampoco debería arrancar un evento de a dos"
  );
}

// ------------------------------------------------------------
// 6. Pesos por defecto
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pesos por defecto");
  const comprobar = comprobarEn(reporte);

  comprobar(
    Object.keys(PESOS).length === Object.keys(EVENTS).length,
    "cada evento del catálogo debería tener un peso"
  );
  comprobar(
    Object.values(PESOS).every((peso) => peso > 0),
    "todos los pesos deberían permitir el evento"
  );
  comprobar(PESOS.approach >= PESOS.faint, "acercarse debería ser más probable que desmayarse");
}

// ------------------------------------------------------------
// 7. Ritmo social espontáneo
// ------------------------------------------------------------

{
  const reporte = crearReporte("SocialPacer: emociones espontáneas");
  const comprobar = comprobarEn(reporte);

  let t = 10_000_000;
  let r = 0;
  const pacer = new SocialPacer({ ahora: () => t, random: () => r, cadaMs: 1000 });
  const system = new Reacciones();

  system.registerOrganism({ id: "org-a" });
  pacer.update(system);

  comprobar(
    system.getOrganism("org-a").emotion !== "neutral",
    "con el azar en 0 debería cambiar la emoción"
  );

  const emocion = system.getOrganism("org-a").emotion;

  // Sin tiempo nuevo, no se vuelve a revisar.
  pacer.update(system);
  comprobar(
    system.getOrganism("org-a").emotion === emocion,
    "no debería cambiar dos veces en el mismo instante"
  );

  // Con azar alto se saltea el cambio.
  r = 0.99;
  t += 2000;
  pacer.update(system);
  comprobar(
    system.getOrganism("org-a").emotion === emocion,
    "con azar alto la emoción se mantiene"
  );

  comprobar(
    !EMOCIONES_ESPONTANEAS.includes("fainted"),
    "desmayarse solo debería llegar por el evento faint"
  );
}

{
  const reporte = crearReporte("SocialPacer: relación por distancia");
  const comprobar = comprobarEn(reporte);

  let t = 20_000_000;
  let r = 0;
  const pacer = new SocialPacer({ ahora: () => t, random: () => r, cadaMs: 1000 });
  const system = new Reacciones();

  system.registerOrganism({ id: "org-a" });
  system.registerOrganism({ id: "org-b" });

  pacer.update(system, { distancia: 0.2 });
  comprobar(
    system.getRelationship("org-a", "org-b") === "mutual_love",
    "cerca y con azar bajo debería aparecer el amor mutuo"
  );

  // Una relación existente se puede disolver.
  r = 0.1;
  t += 2000;
  pacer.update(system, { distancia: 0.2 });
  comprobar(
    system.getRelationship("org-a", "org-b") === null,
    "con el corte sorteado la relación debería desaparecer"
  );

  // Lejos, el vínculo tiende al conflicto.
  r = 0.5;
  t += 2000;
  pacer.update(system, { distancia: 0.9 });
  comprobar(
    system.getRelationship("org-a", "org-b") === "conflict",
    "lejos, con azar bajo, debería aparecer el conflicto"
  );
}

{
  const reporte = crearReporte("SocialPacer: un solo organismo");
  const comprobar = comprobarEn(reporte);

  let t = 30_000_000;
  const pacer = new SocialPacer({ ahora: () => t, random: () => 0, cadaMs: 1000 });
  const system = new Reacciones();

  system.registerOrganism({ id: "org-a" });

  for (let i = 0; i < 10; i++) {
    t += 1500;
    pacer.update(system, { distancia: null });
  }

  comprobar(
    system.getOrganism("org-a") !== null,
    "el organismo sigue registrado"
  );
  comprobar(
    system.relationships.size === 0,
    "sin pareja no debería haber relaciones"
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
