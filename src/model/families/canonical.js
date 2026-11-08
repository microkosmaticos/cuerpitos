// ============================================================
// canonical.js
//
// Convierte la canónica de una familia (números fijos) en puntos
// listos para dibujar. Es el puente entre "el plano" y "la muestra".
//
// Acá SÍ hay geometría (rotar, mover al borde), pero sigue siendo
// modelo: no se dibuja nada, ni se usa p5, ni hay aleatoriedad.
// ============================================================

import { crearApendice, crearBlob, crearLobulo, crearMasa, crearPunta } from "./baseShapes.js";

// Qué generador usar según la "forma base" que declara el slot.
// Las familias que vengan después solo tienen que usar estos nombres.
//
// MEDIDAS que llegan desde la canónica:
//   - parte.size      → RADIO de la masa (no el diámetro)
//   - parte.length    → distancia de la base a la punta
//   - parte.thickness → ancho en la base
const GENERADORES = {
  blob: (parte) => crearBlob({ radio: parte.size }),
  apendice: (parte) =>
    crearApendice({ largo: parte.length, grosor: parte.thickness, curva: parte.curva }),
  lobulo: (parte) => crearLobulo({ radio: parte.size }),
  punta: (parte) => crearPunta({ largo: parte.length, base: parte.thickness, curva: parte.curva }),
  masa: (parte) => crearMasa({ radio: parte.size }),
};

/**
 * Construye los puntos de la forma canónica de una familia.
 * Devuelve { familyId, name, description, parts, bounds }.
 *
 * Cada parte conserva id, rol y ancla, para que después el tracking
 * pueda mover una parte suelta sin tocar las demás.
 */
export function construirCanonica(familia) {
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((conexion) => [conexion.child, conexion]));

  const construidas = new Map();
  const partes = [];

  for (const parte of familia.canonical.parts) {
    const slot = slotsPorId.get(parte.slotId);
    if (!slot) {
      throw new Error(`La familia "${familia.id}" no tiene un slot llamado "${parte.slotId}".`);
    }

    const generador = GENERADORES[slot.baseShape];
    if (!generador) {
      throw new Error(`Forma base desconocida: "${slot.baseShape}".`);
    }

    let puntos = generador(parte);

    // Si esta parte se conecta a otra, la movemos al borde de su padre
    // y la rotamos para que salga en la dirección indicada.
    const conexion = conexionPorHijo.get(slot.id);
    if (conexion) {
      const padre = construidas.get(conexion.parent);
      if (!padre) {
        throw new Error(
          `La parte "${slot.id}" necesita que "${conexion.parent}" esté antes en la canónica.`
        );
      }

      const angulo = parte.angle ?? 0;
      const radianes = gradosARadianes(angulo);
      const puntoUnion = puntoDeBorde(padre.points, angulo);

      // Hundimos la base un poco dentro del padre: así la unión
      // no queda con una costura visible. Si la parte tiene grosor,
      // entra medio grosor; si es una masa, entra un quinto de su tamaño.
      const hundido = parte.thickness ? parte.thickness / 2 : (parte.size ?? 0) * 0.2;

      puntos = rotarYTrasladar(
        puntos,
        radianes,
        puntoUnion.x - Math.cos(radianes) * hundido,
        puntoUnion.y - Math.sin(radianes) * hundido
      );
    }

    const construida = {
      id: slot.id,
      role: slot.role,
      anchor: slot.anchor,
      points: puntos,
    };

    construidas.set(slot.id, construida);
    partes.push(construida);
  }

  return {
    familyId: familia.id,
    name: familia.name,
    description: familia.description,
    parts: partes,
    bounds: calcularBounds(partes),
  };
}

// ------------------------------------------------------------
// Ayudas de geometría
// ------------------------------------------------------------

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
