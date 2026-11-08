// ============================================================
// createGenome.js
//
// Crea el "genoma" de un organismo: los valores concretos de cada
// parte, elegidos al azar dentro de los rangos que declara su familia.
//
// Reglas:
//   1. La aleatoriedad es reproducible: misma semilla = mismo genoma.
//   2. Se usan los PRIMEROS N slots de cada rol (ids estables).
//   3. COMPOSICIÓN ORIGINAL: las piezas "de origen" mantienen la
//      dirección que tenían en el dibujo, con un giro de ±8°.
//   4. Las piezas EXTRA eligen un ángulo libre a 60° o más de las
//      que ya están puestas, para que no se amontonen.
//   5. Las cadenas (antebrazos) continúan la dirección de su brazo ±8°.
//   6. En una cadena, una parte nunca es más grande que su padre.
//   7. Si el padre de una parte no nació, la parte tampoco nace.
//
// "radius" es RADIO (no diámetro); "width" y "height" son ancho y
// alto máximos de una silueta.
// ============================================================

import { SeededRandom } from "../random/SeededRandom.js";
import { congelarProfundo } from "../families/deepFreeze.js";
import { getSilueta } from "../families/silhouettes.js";

/** Separación mínima, en grados, entre dos piezas que salen del torso. */
export const SEPARACION_MINIMA = 60;

/**
 * Separación que se garantiza aunque haya muchas piezas.
 * Con 5 o 6 piezas el círculo no alcanza para 60° y baja a ~52°;
 * este es el piso que no se cruza nunca.
 */
export const SEPARACION_GARANTIZADA = 45;

/** Giro máximo que se le permite a cada pieza, en grados. */
export const GIRO_MAXIMO = 8;

// Cuántos ángulos se prueban antes de quedarse con el más lejano.
const INTENTOS_DE_ANGULO = 300;

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
    // La cabeza es siempre 1 y se sortea aparte, con su propio
    // generador: así no consume números del generador principal y
    // agregarla no cambia la anatomía de ninguna semilla conocida.
    if (rol === "cabeza") continue;
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

  // 4. Ángulos.
  const angulos = asignarAngulos(rng, familia, usados);

  // 5. Armar la lista de partes.
  const partes = [];
  for (const slot of familia.slots) {
    if (!usados.has(slot.id)) continue;

    const parte = { slotId: slot.id, ...valores.get(slot.id) };
    if (angulos.has(slot.id)) parte.angle = angulos.get(slot.id);
    partes.push(parte);
  }

  // 6. La cabeza, si la familia la declara, va con su PROPIO generador.
  //    Es siempre 1, va rígida con el torso (sin ancla de tracking) y
  //    no altera ningún valor de la anatomía ya sorteada.
  const slotCabeza = familia.slots.find((slot) => slot.role === "cabeza");
  if (slotCabeza) {
    const rngCabeza = new SeededRandom((rng.seed ^ 0x1b873593) >>> 0);
    const direccion = radianesAGrados(getSilueta(slotCabeza.silhouette).direccion);

    partes.push({
      slotId: slotCabeza.id,
      ...sortearValores(rngCabeza, slotCabeza),
      angle: normalizarAngulo(direccion + rngCabeza.range(-GIRO_MAXIMO, GIRO_MAXIMO)),
    });
  }

  // 6. Padres antes que hijos.
  const ordenadas = ordenarPorDependencia(familia, partes, conexionPorHijo);

  // 7. Regla de cadena.
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
 * Ángulos con composición original:
 *   - las piezas de origen usan la dirección del dibujo ±8°
 *   - las extra buscan un ángulo libre a 60° o más
 *   - las cadenas continúan a su padre ±8°
 */
function asignarAngulos(rng, familia, usados) {
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const resultado = new Map();
  const raicesColocadas = [];

  const raices = familia.connections.filter(
    (conexion) => conexion.parent === "nucleo" && usados.has(conexion.child)
  );

  // Piezas originales del dibujo.
  for (const conexion of raices) {
    const slot = slotsPorId.get(conexion.child);
    if (!slot.origen || !slot.silhouette) continue;

    const direccion = radianesAGrados(getSilueta(slot.silhouette).direccion);
    const angulo = normalizarAngulo(direccion + rng.range(-GIRO_MAXIMO, GIRO_MAXIMO));

    resultado.set(conexion.child, angulo);
    raicesColocadas.push(angulo);
  }

  // Piezas extra: ángulo libre, lejos de las anteriores.
  for (const conexion of raices) {
    const slot = slotsPorId.get(conexion.child);
    if (slot.origen) continue;

    const angulo = elegirAnguloLibre(rng, raicesColocadas);
    resultado.set(conexion.child, angulo);
    raicesColocadas.push(angulo);
  }

  // Cadenas: siguen a su padre.
  for (const conexion of familia.connections) {
    if (conexion.parent === "nucleo") continue;
    if (!usados.has(conexion.child) || !usados.has(conexion.parent)) continue;

    const anguloPadre = resultado.get(conexion.parent) ?? 0;
    resultado.set(
      conexion.child,
      normalizarAngulo(anguloPadre + rng.range(-GIRO_MAXIMO, GIRO_MAXIMO))
    );
  }

  return resultado;
}

/**
 * Busca un ángulo para una pieza extra.
 *
 * Se coloca en el MEDIO del hueco más grande entre las piezas ya
 * puestas. Así queda lo más lejos posible de todas: si el espacio
 * alcanza da 60° o más, y si hay muchas piezas da el máximo que
 * permita el círculo (por ejemplo ~50° con seis piezas).
 */
function elegirAnguloLibre(rng, yaColocados) {
  if (yaColocados.length === 0) {
    return normalizarAngulo(rng.range(0, 360));
  }

  const ordenados = [...yaColocados].sort((a, b) => a - b);

  let mejorDesde = 0;
  let mejorAmplitud = -1;

  for (let i = 0; i < ordenados.length; i++) {
    const desde = ordenados[i];
    const hasta = i + 1 < ordenados.length ? ordenados[i + 1] : ordenados[0] + 360;
    const amplitud = hasta - desde;

    if (amplitud > mejorAmplitud) {
      mejorAmplitud = amplitud;
      mejorDesde = desde;
    }
  }

  return normalizarAngulo(mejorDesde + mejorAmplitud / 2);
}

function distanciaMinima(angulo, lista) {
  let minima = 360;

  for (const otro of lista) {
    const diferencia = Math.abs(angulo - otro) % 360;
    const distancia = Math.min(diferencia, 360 - diferencia);
    if (distancia < minima) minima = distancia;
  }

  return minima;
}

function normalizarAngulo(angulo) {
  return ((angulo % 360) + 360) % 360;
}

function radianesAGrados(radianes) {
  return (radianes * 180) / Math.PI;
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
        resultado.push(parte);
        emitidos.add(parte.slotId);
        huboProgreso = true;
      } else if (emitidos.has(conexion.parent)) {
        resultado.push(parte);
        emitidos.add(parte.slotId);
        huboProgreso = true;
      } else if (!porId.has(conexion.parent)) {
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
