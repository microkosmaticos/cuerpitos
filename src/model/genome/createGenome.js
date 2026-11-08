// ============================================================
// createGenome.js
//
// Crea el "genoma" de un organismo: los valores concretos de cada
// parte, elegidos al azar dentro de los rangos que declara su familia.
//
// Reglas:
//   1. La aleatoriedad es reproducible: misma semilla = mismo genoma.
//   2. Se usan los PRIMEROS N slots de cada rol, así los ids son
//      estables (apendice-1, apendice-2...).
//   3. El núcleo va siempre primero y la cabeza siempre existe.
//   4. Las partes hermanas se separan al menos 20° para que no se
//      amontonen. Si el rango de ángulos es muy angosto, se elige el
//      lugar más lejano posible.
//   5. En una cadena, una parte nunca es más grande que su padre.
//   6. Si el padre de una parte no nació, la parte tampoco nace.
//
// "radius" es RADIO (no diámetro); "width" y "height" son ancho y
// alto máximos de una silueta.
// ============================================================

import { SeededRandom } from "../random/SeededRandom.js";
import { congelarProfundo } from "../families/deepFreeze.js";

/** Separación mínima, en grados, entre dos partes del mismo padre. */
export const SEPARACION_MINIMA = 20;

/**
 * @param {object} familia familia anatómica
 * @param {number|string} seed semilla
 */
export function createGenome(familia, seed) {
  const rng = new SeededRandom(seed);
  const conexionPorHijo = new Map(familia.connections.map((c) => [c.child, c]));

  // 1. Cuántas partes de cada rol.
  const cantidadPorRol = new Map();
  for (const [rol, rango] of Object.entries(familia.roles)) {
    cantidadPorRol.set(rol, rng.int(rango.min, rango.max));
  }

  // 2. Qué slots se usan: los primeros N de cada rol.
  const usados = new Set();
  for (const [rol, cantidad] of cantidadPorRol) {
    const delRol = familia.slots.filter((slot) => slot.role === rol).slice(0, cantidad);
    for (const slot of delRol) usados.add(slot.id);
  }

  // 3. Valores de medida de cada parte usada.
  const valores = new Map();
  for (const slot of familia.slots) {
    if (!usados.has(slot.id)) continue;
    valores.set(slot.id, sortearValores(rng, slot));
  }

  // 4. Ángulos, agrupados por padre.
  const angulos = asignarAngulos(rng, familia, usados, conexionPorHijo);

  // 5. Armar la lista de partes.
  const partes = [];
  for (const slot of familia.slots) {
    if (!usados.has(slot.id)) continue;

    const parte = { slotId: slot.id, ...valores.get(slot.id) };
    if (angulos.has(slot.id)) parte.angle = angulos.get(slot.id);
    partes.push(parte);
  }

  // 6. Ordenar para que cada padre aparezca antes que sus hijos.
  const ordenadas = ordenarPorDependencia(familia, partes, conexionPorHijo);

  // 7. Regla de cadena: una parte nunca es más grande que su padre.
  aplicarReglaDeCadena(familia, ordenadas, conexionPorHijo);

  return congelarProfundo({
    familyId: familia.id,
    seed: rng.seed,
    parts: ordenadas,
  });
}

// ------------------------------------------------------------
// Valores
// ------------------------------------------------------------

/** Sortea un número dentro de cada rango que declara el slot. */
function sortearValores(rng, slot) {
  const valores = {};

  for (const [medida, rango] of Object.entries(slot.ranges)) {
    valores[medida] = rng.range(rango.min, rango.max);
  }

  return valores;
}

// ------------------------------------------------------------
// Ángulos
// ------------------------------------------------------------

/**
 * Reparte los ángulos de las partes que cuelgan del mismo padre.
 *
 * Estrategia (sin rechazos aleatorios, para que siempre cumpla):
 *   1. Las partes con rango limitado (por ejemplo la cabeza, que solo
 *      puede ir arriba) se agrupan por rango y se reparten PAREJO
 *      dentro de su rango.
 *   2. Las partes de rango completo (0–360) se reparten parejo en el
 *      hueco que dejaron las anteriores, dejando SEPARACION_MINIMA
 *      a cada lado.
 *
 * Resultado: dos partes del mismo padre nunca quedan más cerca que
 * la separación mínima, salvo que el rango sea tan angosto que no
 * entre nada más (ahí el reparto parejo ya es lo más separado posible).
 */
function asignarAngulos(rng, familia, usados, conexionPorHijo) {
  const hijosPorPadre = new Map();

  for (const conexion of familia.connections) {
    if (!usados.has(conexion.child) || !usados.has(conexion.parent)) continue;
    if (!hijosPorPadre.has(conexion.parent)) hijosPorPadre.set(conexion.parent, []);
    hijosPorPadre.get(conexion.parent).push({
      slotId: conexion.child,
      rango: conexion.angleRange,
    });
  }

  const resultado = new Map();

  for (const hijos of hijosPorPadre.values()) {
    repartirAngulosDeGrupo(rng, hijos, resultado);
  }

  return resultado;
}

function repartirAngulosDeGrupo(rng, hijos, resultado) {
  const parciales = hijos.filter((hijo) => hijo.rango.max - hijo.rango.min < 360);
  const completos = hijos.filter((hijo) => hijo.rango.max - hijo.rango.min >= 360);

  // 1. Partes con rango limitado: se agrupan por rango idéntico.
  const porRango = new Map();

  for (const hijo of parciales) {
    const clave = `${hijo.rango.min}:${hijo.rango.max}`;
    if (!porRango.has(clave)) porRango.set(clave, { rango: hijo.rango, hijos: [] });
    porRango.get(clave).hijos.push(hijo);
  }

  for (const grupo of porRango.values()) {
    repartirEnRango(rng, grupo.rango, grupo.hijos, resultado);
  }

  // 2. Partes de rango completo: se reparten en el hueco libre.
  if (completos.length > 0) {
    repartirEnCirculo(rng, completos, resultado);
  }
}

/** Reparte n partes parejo dentro de [min, max]. */
function repartirEnRango(rng, rango, hijos, resultado) {
  const amplitud = rango.max - rango.min;
  if (amplitud <= 0) {
    for (const hijo of hijos) resultado.set(hijo.slotId, rango.min);
    return;
  }

  const paso = amplitud / hijos.length;
  // Punto de arranque al azar dentro del primer tramo.
  const desplazamiento = rng.range(0, paso);

  hijos.forEach((hijo, indice) => {
    resultado.set(hijo.slotId, rango.min + desplazamiento + paso * indice);
  });
}

/** Reparte las partes de rango completo en el mayor hueco libre del círculo. */
function repartirEnCirculo(rng, hijos, resultado) {
  const ocupados = [...resultado.values()].sort((a, b) => a - b);

  // Hueco disponible: de un ángulo ocupado al siguiente, con su margen.
  let desde = SEPARACION_MINIMA;
  let hasta = 360 - SEPARACION_MINIMA;

  if (ocupados.length > 0) {
    // Se busca el hueco más grande entre dos ángulos ocupados.
    let mejorInicio = 0;
    let mejorAmplitud = -Infinity;

    for (let i = 0; i < ocupados.length; i++) {
      const inicio = ocupados[i];
      const siguiente = i + 1 < ocupados.length ? ocupados[i + 1] : ocupados[0] + 360;
      const amplitud = siguiente - inicio - 2 * SEPARACION_MINIMA;
      if (amplitud > mejorAmplitud) {
        mejorAmplitud = amplitud;
        mejorInicio = inicio;
      }
    }

    desde = mejorInicio + SEPARACION_MINIMA;
    hasta = mejorInicio + 360 - SEPARACION_MINIMA;
  }

  const amplitud = hasta - desde;
  const paso = amplitud / hijos.length;
  const desplazamiento = rng.range(0, Math.max(paso, 1e-6));

  hijos.forEach((hijo, indice) => {
    // Se normaliza a [0, 360): en JavaScript el % de un negativo da negativo.
    const crudo = desde + desplazamiento + paso * indice;
    resultado.set(hijo.slotId, ((crudo % 360) + 360) % 360);
  });
}

// ------------------------------------------------------------
// Orden y coherencia
// ------------------------------------------------------------

/**
 * Ordena las partes para que cada padre aparezca antes que sus hijos.
 * Si el padre no existe (no nació), la parte tampoco nace.
 */
function ordenarPorDependencia(familia, partes, conexionPorHijo) {
  const porId = new Map(partes.map((parte) => [parte.slotId, parte]));
  const emitidos = new Set();
  const resultado = [];

  let pendientes = [...partes];

  while (pendientes.length > 0) {
    const siguiente = [];
    let huboProgreso = false;

    for (const parte of pendientes) {
      const conexion = conexionPorHijo.get(parte.slotId);

      if (!conexion) {
        // El núcleo no cuelga de nadie.
        resultado.push(parte);
        emitidos.add(parte.slotId);
        huboProgreso = true;
      } else if (emitidos.has(conexion.parent)) {
        resultado.push(parte);
        emitidos.add(parte.slotId);
        huboProgreso = true;
      } else if (!porId.has(conexion.parent)) {
        // El padre no nació: esta parte se descarta.
        huboProgreso = true;
      } else {
        siguiente.push(parte);
      }
    }

    if (!huboProgreso) {
      throw new Error(`Dependencia circular en la familia "${familia.id}"`);
    }

    pendientes = siguiente;
  }

  return resultado;
}

/**
 * En una cadena, cada parte toma como máximo la medida de su padre.
 * El núcleo queda afuera: no limita a sus hijos.
 *
 * Ojo: si el mínimo permitido del hijo ya es mayor que el padre,
 * gana el mínimo del hijo (no se puede pedir algo más chico que su
 * propio rango). Por eso la regla es "lo más chico posible".
 */
function aplicarReglaDeCadena(familia, partes, conexionPorHijo) {
  const porId = new Map(partes.map((parte) => [parte.slotId, parte]));
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));

  for (const parte of partes) {
    const conexion = conexionPorHijo.get(parte.slotId);
    if (!conexion) continue;

    const slotPadre = slotsPorId.get(conexion.parent);
    if (!slotPadre || slotPadre.role === "nucleo") continue;

    const padre = porId.get(conexion.parent);
    if (!padre) continue;

    const slot = slotsPorId.get(parte.slotId);

    for (const medida of ["radius", "width"]) {
      if (typeof parte[medida] !== "number" || typeof padre[medida] !== "number") continue;

      const minimo = slot.ranges[medida].min;
      parte[medida] = Math.max(minimo, Math.min(parte[medida], padre[medida]));
    }
  }
}
