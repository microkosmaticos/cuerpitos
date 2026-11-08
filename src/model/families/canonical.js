// ============================================================
// canonical.js
//
// Convierte una lista de partes (los números fijos de una canónica
// o los valores al azar de un genoma) en puntos listos para dibujar.
//
// Acá SÍ hay geometría (rotar, mover al borde, hundir la base), pero
// sigue siendo modelo: no se dibuja nada, ni se usa p5, ni hay
// aleatoriedad.
//
// Tipos de forma base:
//   - "esfera"  → usa radius (RADIO, no diámetro)
//   - "silueta" → usa width y height (ancho y alto máximos)
// ============================================================

import { crearEsfera, crearSilueta } from "./baseShapes.js";
import { getSilueta } from "./silhouettes.js";

// Qué generador usar según la "forma base" que declara el slot.
const GENERADORES = {
  esfera: (parte) => crearEsfera({ radio: parte.radius }),
  silueta: (parte, slot) => crearSilueta(getSilueta(slot.silhouette), parte.width, parte.height),
};

/**
 * Construye la forma completa de una familia a partir de una lista
 * de partes con los valores ya decididos.
 *
 * @param {object} familia familia anatómica
 * @param {object[]} partes lista con slotId y los valores de cada parte
 */
export function construirForma(familia, partes) {
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((conexion) => [conexion.child, conexion]));

  const construidas = new Map();
  const resultado = [];

  for (const parte of partes) {
    const slot = slotsPorId.get(parte.slotId);
    if (!slot) {
      throw new Error(`La familia "${familia.id}" no tiene un slot llamado "${parte.slotId}".`);
    }

    const generador = GENERADORES[slot.baseShape];
    if (!generador) {
      throw new Error(`Forma base desconocida: "${slot.baseShape}".`);
    }

    const construido = generador(parte, slot);
    let points = construido.points;
    let extras = construido.extras;

    // Si esta parte se conecta a otra, la movemos al borde de su padre
    // y la rotamos para que salga en la dirección indicada.
    const conexion = conexionPorHijo.get(slot.id);

    if (conexion) {
      const padre = construidas.get(conexion.parent);
      if (!padre) {
        throw new Error(
          `La parte "${slot.id}" necesita que "${conexion.parent}" esté antes en la lista.`
        );
      }

      const angulo = parte.angle ?? 0;
      const radianes = gradosARadianes(angulo);
      const puntoUnion = puntoDeBorde(padre.points, angulo);
      const hundido = calcularHundido(parte);

      // La parte original apuntaba a "direccion"; la giramos para que
      // apunte al ángulo pedido.
      const giro = radianes - construido.direccion;

      const trasladoX = puntoUnion.x - Math.cos(radianes) * hundido;
      const trasladoY = puntoUnion.y - Math.sin(radianes) * hundido;

      points = rotarYTrasladar(points, giro, trasladoX, trasladoY);
      // Los ojos y cualquier decoración giran y se mueven igual que su parte.
      extras = extras.map((extra) => rotarYTrasladar(extra, giro, trasladoX, trasladoY));
    } else {
      // El núcleo no cuelga de nadie: se centra en el origen.
      // (Una esfera viene "colgada" desde su borde, así que acá se corrige.)
      const centro = centroideDe(points);
      points = trasladar(points, -centro.x, -centro.y);
      extras = extras.map((extra) => trasladar(extra, -centro.x, -centro.y));
    }

    const construida = {
      id: slot.id,
      role: slot.role,
      anchor: slot.anchor,
      points,
      extras,
    };

    construidas.set(slot.id, construida);
    resultado.push(construida);
  }

  return {
    familyId: familia.id,
    name: familia.name,
    description: familia.description,
    parts: resultado,
    bounds: calcularBounds(resultado),
  };
}

/**
 * La forma canónica de una familia: la muestra fija que usa la galería.
 * Es solo un caso particular de construirForma().
 */
export function construirCanonica(familia) {
  return construirForma(familia, familia.canonical.parts);
}

// ------------------------------------------------------------
// Ayudas de geometría
// ------------------------------------------------------------

/**
 * Cuánto se hunde la parte dentro de su padre para que la unión
 * no se vea como una costura.
 */
function calcularHundido(parte) {
  if (typeof parte.radius === "number") return parte.radius * 0.2;
  if (typeof parte.width === "number") return parte.width * 0.1;
  return 0;
}

/**
 * Busca, entre los puntos de una silueta, el que está más lejos
 * en la dirección del ángulo. Ese es el punto del borde donde
 * se conecta la parte hija.
 */
function puntoDeBorde(puntos, anguloGrados) {
  const radianes = gradosARadianes(anguloGrados);
  const dx = Math.cos(radianes);
  const dy = Math.sin(radianes);

  let mejor = puntos[0];
  let mejorProyeccion = -Infinity;

  for (const punto of puntos) {
    const proyeccion = punto.x * dx + punto.y * dy;
    if (proyeccion > mejorProyeccion) {
      mejorProyeccion = proyeccion;
      mejor = punto;
    }
  }

  return mejor;
}

/** Rota los puntos alrededor del origen y después los traslada. */
function rotarYTrasladar(puntos, radianes, trasladoX, trasladoY) {
  const cos = Math.cos(radianes);
  const sin = Math.sin(radianes);

  return puntos.map((punto) => ({
    x: punto.x * cos - punto.y * sin + trasladoX,
    y: punto.x * sin + punto.y * cos + trasladoY,
  }));
}

function gradosARadianes(grados) {
  return (grados * Math.PI) / 180;
}

function centroideDe(puntos) {
  let sumaX = 0;
  let sumaY = 0;
  for (const punto of puntos) {
    sumaX += punto.x;
    sumaY += punto.y;
  }
  return { x: sumaX / puntos.length, y: sumaY / puntos.length };
}

function trasladar(puntos, dx, dy) {
  return puntos.map((punto) => ({ x: punto.x + dx, y: punto.y + dy }));
}

/** Caja que ocupa la forma completa. */
function calcularBounds(partes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const parte of partes) {
    for (const punto of parte.points) {
      if (punto.x < minX) minX = punto.x;
      if (punto.y < minY) minY = punto.y;
      if (punto.x > maxX) maxX = punto.x;
      if (punto.y > maxY) maxY = punto.y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
