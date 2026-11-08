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
import { bornOrganism } from "../src/model/genome/bornOrganism.js";
import { crearVinculos } from "../src/model/tracking/crearVinculos.js";
import { LIMITES, OrganismPose } from "../src/model/tracking/OrganismPose.js";
import { aplicarPose } from "../src/model/tracking/aplicarPose.js";

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
// 3. Vínculo parte ↔ ancla
// ------------------------------------------------------------

/** Persona con los anchors en una posición dada. */
function personaConAnclas(x, y, energy = 0.8, extra = {}) {
  return {
    id: "p0",
    present: true,
    confidence: 0.95,
    center: { x: 0.5, y: 0.5 },
    energy,
    spread: 0.5,
    anchors: Array.from({ length: CANTIDAD_DE_ANCLAS }, () => ({
      x,
      y,
      vx: 0,
      vy: 0,
      confidence: 0.95,
    })),
    ...extra,
  };
}

{
  const reporte = crearReporte("Vínculo: determinista y sin tocar la identidad");
  const comprobar = comprobarEn(reporte);

  for (const semilla of [0, 1, 7, 42]) {
    const organismo = bornOrganism(semilla);
    const a = crearVinculos(organismo.shape, organismo.seed);
    const b = crearVinculos(organismo.shape, organismo.seed);

    comprobar(
      JSON.stringify(a) === JSON.stringify(b),
      `semilla ${semilla}: los vínculos no son deterministas`
    );

    // No cambian genoma ni paleta.
    const otro = bornOrganism(semilla);
    comprobar(
      JSON.stringify(organismo.genome) === JSON.stringify(otro.genome),
      `semilla ${semilla}: el genoma cambió al crear vínculos`
    );
    comprobar(
      JSON.stringify(organismo.palette) === JSON.stringify(otro.palette),
      `semilla ${semilla}: la paleta cambió al crear vínculos`
    );

    // La cabeza y el núcleo no tienen ancla.
    const conCabeza = a.vinculos.some((v) => v.partId === "cabeza");
    comprobar(!conCabeza, `semilla ${semilla}: la cabeza no debería tener vínculo`);

    const cabezas = organismo.shape.parts.filter((parte) => parte.role === "cabeza");
    comprobar(cabezas.length === 1, `semilla ${semilla}: debería haber una cabeza`);
    comprobar(cabezas[0].anchor === null, `semilla ${semilla}: la cabeza no debería tener ancla`);
  }
}

{
  const reporte = crearReporte("Vínculo: anclas válidas y fase");
  const comprobar = comprobarEn(reporte);

  for (let semilla = 0; semilla < 200; semilla++) {
    const organismo = bornOrganism(semilla);
    const { vinculos } = crearVinculos(organismo.shape, organismo.seed);

    for (const vinculo of vinculos) {
      if (!(vinculo.ancla >= 0 && vinculo.ancla < CANTIDAD_DE_ANCLAS)) {
        comprobar(false, `semilla ${semilla}: ancla inválida ${vinculo.ancla}`);
      }
      if (!(vinculo.ganancia > 0 && vinculo.ganancia < 1)) {
        comprobar(false, `semilla ${semilla}: ganancia ${vinculo.ganancia}`);
      }
      if (!(vinculo.retraso > 0)) {
        comprobar(false, `semilla ${semilla}: retraso ${vinculo.retraso}`);
      }
    }
  }

  comprobar(true, "las anclas y el temperamento caen en rango");
}

// ------------------------------------------------------------
// 4. Pose viva: límites, reposo, suavizado, fps y pérdida
// ------------------------------------------------------------

function crearPose(semilla) {
  const organismo = bornOrganism(semilla);
  const vinculos = crearVinculos(organismo.shape, organismo.seed);
  const pose = new OrganismPose(organismo.shape, vinculos);
  return { organismo, vinculos, pose };
}

{
  const reporte = crearReporte("Pose: los límites no se superan");
  const comprobar = comprobarEn(reporte);

  // Entrada extrema: todas las anclas pegadas a una esquina.
  const { pose } = crearPose(3);
  const extrema = personaConAnclas(1, 0, 1);

  for (let i = 0; i < 600; i++) pose.update(1 / 60, extrema);

  const maximoAngulo = (LIMITES.angulo * Math.PI) / 180;
  let dentro = true;

  for (const estado of pose.estado.partes.values()) {
    if (Math.abs(estado.angulo) > maximoAngulo + 1e-9) dentro = false;
    if (Math.abs(estado.curvatura) > LIMITES.curvatura + 1e-9) dentro = false;
    if (estado.escala > 1 + LIMITES.escala + 1e-9 || estado.escala < 1 - LIMITES.escala - 1e-9) dentro = false;
  }

  comprobar(dentro, "alguna parte superó los límites de deformación");

  const desplazamiento = Math.hypot(pose.estado.posicion.x, pose.estado.posicion.y);
  comprobar(
    desplazamiento <= LIMITES.desplazamiento * 2 + 1e-9,
    `el desplazamiento ${desplazamiento.toFixed(3)} se fue de rango`
  );
}

{
  const reporte = crearReporte("Pose: con energía 0 se asienta");
  const comprobar = comprobarEn(reporte);

  const { pose } = crearPose(5);

  // Primero se mueve, después se queda quieto.
  for (let i = 0; i < 120; i++) pose.update(1 / 60, personaConAnclas(0.9, 0.2, 0.9));
  for (let i = 0; i < 600; i++) pose.update(1 / 60, personaConAnclas(0.9, 0.2, 0));

  let maximo = 0;
  for (const estado of pose.estado.partes.values()) {
    maximo = Math.max(maximo, Math.abs(estado.angulo));
  }

  comprobar(maximo < 0.01, `con energía 0 los ángulos deberían volver a 0 y quedó ${maximo.toFixed(4)}`);

  const antes = JSON.stringify([...pose.estado.partes]);
  for (let i = 0; i < 60; i++) pose.update(1 / 60, personaConAnclas(0.9, 0.2, 0));
  const despues = JSON.stringify([...pose.estado.partes]);

  comprobar(antes === despues, "en reposo la pose no debería cambiar");
}

{
  const reporte = crearReporte("Pose: un salto no se copia literal");
  const comprobar = comprobarEn(reporte);

  const { pose, vinculos } = crearPose(9);
  const primerVinculo = vinculos.vinculos[0];

  // Un paso con el ancla lejos: el ángulo tiene que ser mucho menor
  // que la desviación real.
  pose.update(1 / 60, personaConAnclas(1, 0, 1));

  const estado = pose.estado.partes.get(primerVinculo.partId);
  const desvioReal = (25 * Math.PI) / 180;

  comprobar(
    Math.abs(estado.angulo) < desvioReal * 0.5,
    `la parte saltó ${estado.angulo.toFixed(4)} rad en un solo frame`
  );
  comprobar(
    primerVinculo.ganancia < 1,
    `la ganancia debería ser menor que 1 y es ${primerVinculo.ganancia}`
  );
}

{
  const reporte = crearReporte("Pose: 30 y 60 fps dan lo mismo");
  const comprobar = comprobarEn(reporte);

  const persona = personaConAnclas(0.85, 0.2, 0.8);

  const treinta = crearPose(11).pose;
  const sesenta = crearPose(11).pose;

  for (let i = 0; i < 90; i++) treinta.update(1 / 30, persona);
  for (let i = 0; i < 180; i++) sesenta.update(1 / 60, persona);

  let diferenciaMaxima = 0;
  for (const [partId, estado] of treinta.estado.partes) {
    const otro = sesenta.estado.partes.get(partId);
    diferenciaMaxima = Math.max(diferenciaMaxima, Math.abs(estado.angulo - otro.angulo));
  }

  comprobar(
    diferenciaMaxima < 1e-6,
    `las poses difieren en ${diferenciaMaxima.toExponential(3)} rad`
  );
}

{
  const reporte = crearReporte("Pose: pérdida de señal");
  const comprobar = comprobarEn(reporte);

  const { pose } = crearPose(13);

  for (let i = 0; i < 60; i++) pose.update(1 / 60, personaConAnclas(0.9, 0.2, 0.9));

  const sinSenal = {
    id: "p0",
    present: false,
    confidence: 0.1,
    center: { x: 0.5, y: 0.5 },
    energy: 0,
    spread: 0,
    anchors: Array.from({ length: CANTIDAD_DE_ANCLAS }, () => null),
  };

  for (let i = 0; i < 180; i++) pose.update(1 / 60, sinSenal);

  comprobar(pose.estado.senal < 0.05, `la señal debería caer a casi 0 y quedó ${pose.estado.senal.toFixed(3)}`);
  comprobar(pose.estado.estadoSenal === "sin-senal", `estado de señal: ${pose.estado.estadoSenal}`);
  comprobar(pose.shape.parts.length > 0, "el organismo no debería desaparecer");
}

// ------------------------------------------------------------
// 4b. Objetivo por movimiento (no por posición)
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: anclas quietas no deforman");
  const comprobar = comprobarEn(reporte);

  // Ancla quieta en una esquina, energía alta, diez segundos.
  const quieta = personaConAnclas(0.9, 0.2, 1);
  const { pose } = crearPose(17);

  for (let i = 0; i < 600; i++) pose.update(1 / 60, quieta);

  let maximo = 0;
  for (const estado of pose.estado.partes.values()) {
    maximo = Math.max(maximo, Math.abs(estado.angulo));
  }

  const medioGrado = (0.5 * Math.PI) / 180;
  comprobar(
    maximo < medioGrado,
    `quieta y con energía alta, el ángulo debería quedar cerca de 0 y quedó ${((maximo * 180) / Math.PI).toFixed(2)}°`
  );
}

{
  const reporte = crearReporte("Pose: las anclas que oscilan mueven");
  const comprobar = comprobarEn(reporte);

  // La oscilación es vertical porque los brazos apuntan en horizontal:
  // así la proyección perpendicular es máxima.
  const oscilante = (t, amplitud) =>
    personaConAnclas(0.5, 0.5 + amplitud * Math.sin(2 * Math.PI * 0.6 * t), 0.9);

  const correr = (amplitud) => {
    const { pose } = crearPose(19);
    let maximo = 0;
    for (let i = 0; i < 600; i++) {
      const t = i / 60;
      pose.update(1 / 60, oscilante(t, amplitud));
      for (const estado of pose.estado.partes.values()) {
        maximo = Math.max(maximo, Math.abs(estado.angulo));
      }
    }
    return maximo;
  };

  const chico = correr(0.025);
  const grande = correr(0.05);

  const unGrado = Math.PI / 180;
  const veintidosGrados = (22.5 * Math.PI) / 180;

  comprobar(grande > unGrado, `la oscilación debería mover y movió ${((grande * 180) / Math.PI).toFixed(2)}°`);
  comprobar(
    grande < veintidosGrados,
    `la oscilación no debería pegarse al límite y llegó a ${((grande * 180) / Math.PI).toFixed(1)}°`
  );

  const proporcion = grande / chico;
  comprobar(
    proporcion > 1.4 && proporcion < 2.6,
    `al duplicar la amplitud la respuesta creció ${proporcion.toFixed(2)} veces`
  );
}

// ------------------------------------------------------------
// 5. Jerarquía: el hijo sigue al padre
// ------------------------------------------------------------

{
  const reporte = crearReporte("Pose: el antebrazo sigue al brazo");
  const comprobar = comprobarEn(reporte);

  const problemas = [];

  for (let semilla = 0; semilla < 1000; semilla++) {
    const organismo = bornOrganism(semilla);
    const vinculos = crearVinculos(organismo.shape, organismo.seed);
    const pose = new OrganismPose(organismo.shape, vinculos);

    // Entrada extrema: los brazos se van al tope del límite.
    const extrema = personaConAnclas(1, 0, 1);
    for (let i = 0; i < 240; i++) pose.update(1 / 60, extrema);

    const partes = aplicarPose(organismo.shape, pose.estado);
    const porId = new Map(partes.map((parte) => [parte.id, parte]));
    const restantes = new Map(organismo.shape.parts.map((parte) => [parte.id, parte]));

    for (const parte of partes) {
      if (!parte.parent) continue;

      const padre = porId.get(parte.parent);
      const rest = restantes.get(parte.id);
      const restPadre = restantes.get(parte.parent);
      if (!padre || !rest || !restPadre) continue;

      // Vector en reposo y vector deformado, desde el padre.
      const reposo = {
        x: rest.origen.x - restPadre.origen.x,
        y: rest.origen.y - restPadre.origen.y,
      };
      const actual = {
        x: parte.origenActual.x - padre.origenActual.x,
        y: parte.origenActual.y - padre.origenActual.y,
      };

      const anguloPadre = pose.estado.partes.get(padre.id)?.angulo ?? 0;
      const esperado = Math.atan2(reposo.y, reposo.x) + anguloPadre;
      const obtenido = Math.atan2(actual.y, actual.x);

      let diferencia = Math.abs(obtenido - esperado) % (Math.PI * 2);
      if (diferencia > Math.PI) diferencia = Math.PI * 2 - diferencia;

      // Tolerancia: 1 % del tamaño de la parte, medido como arco.
      const tamano = Math.max(
        ...rest.points.map((punto) =>
          Math.hypot(punto.x - rest.origen.x, punto.y - rest.origen.y)
        )
      );
      const palanca = Math.max(1e-6, Math.hypot(reposo.x, reposo.y));
      const tolerancia = (tamano * 0.01) / palanca;

      if (diferencia > tolerancia) {
        problemas.push(
          `semilla ${semilla}: ${parte.id} desviado ${diferencia.toFixed(3)} rad (tolerancia ${tolerancia.toFixed(3)})`
        );
      }
    }
  }

  comprobar(
    problemas.length === 0,
    `${problemas.length} uniones rotas -> ${problemas.slice(0, 3).join(" | ")}`
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
