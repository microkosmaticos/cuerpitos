// ============================================================
// silhouettes.js
//
// Biblioteca de SILUETAS sacadas de los SVG de archivossvg/.
// Es el vocabulario de formas de las familias: torso, cabeza,
// brazo y antebrazo de cada dibujo. NO se usan la cabeza ni los
// ojos para generar caras nuevas: son solo las formas del dibujo.
//
// Cada silueta se guarda NORMALIZADA:
//   - su punto de unión queda en (0, 0),
//   - "direccion" dice hacia dónde apuntaba la parte en el dibujo,
//     así después se la puede rotar a cualquier ángulo.
//
// Para el torso el origen es su centro (es el núcleo, no se cuelga
// de nada) y para la cabeza el origen es su punto más bajo.
//
// Las siluetas están congeladas: nadie las modifica en tiempo real.
// ============================================================

import { SHAPES } from "../shapes.data.js";
import { loadShapes } from "../ShapeLoader.js";
import { congelarProfundo } from "./deepFreeze.js";

const SILUETAS = {};

// ------------------------------------------------------------
// Ayudas de geometría
// ------------------------------------------------------------

function trasladar(puntos, dx, dy) {
  return puntos.map((punto) => ({ x: punto.x + dx, y: punto.y + dy }));
}

function centroide(puntos) {
  let sumaX = 0;
  let sumaY = 0;
  for (const punto of puntos) {
    sumaX += punto.x;
    sumaY += punto.y;
  }
  return { x: sumaX / puntos.length, y: sumaY / puntos.length };
}

function puntoMasCercano(puntos, referencia) {
  let mejor = puntos[0];
  let mejorDistancia = Infinity;

  for (const punto of puntos) {
    const dx = punto.x - referencia.x;
    const dy = punto.y - referencia.y;
    const distancia = dx * dx + dy * dy;
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = punto;
    }
  }

  return mejor;
}

/**
 * Normaliza una parte que cuelga de otra:
 * el punto más cercano a la referencia pasa a (0, 0) y se guarda
 * la dirección en la que la parte se aleja del cuerpo.
 */
function normalizar(puntos, ojos, referencia) {
  const anclaje = puntoMasCercano(puntos, referencia);
  const centro = centroide(puntos);

  return congelarProfundo({
    puntos: trasladar(puntos, -anclaje.x, -anclaje.y),
    // Los ojos viajan en el mismo sistema de coordenadas que su cabeza.
    ojos: ojos.map((ojo) => trasladar(ojo, -anclaje.x, -anclaje.y)),
    direccion: Math.atan2(centro.y - anclaje.y, centro.x - anclaje.x),
  });
}

/** El núcleo se guarda centrado en (0, 0), sin punto de unión. */
function centrar(puntos) {
  const centro = centroide(puntos);

  return congelarProfundo({
    puntos: trasladar(puntos, -centro.x, -centro.y),
    ojos: [],
    direccion: 0,
  });
}

// ------------------------------------------------------------
// Construcción de la biblioteca
// ------------------------------------------------------------

for (const forma of loadShapes(SHAPES)) {
  const torso = forma.getPart("torso").sides[0].points;
  // Todas las partes del dibujo se referencian contra el centro del torso.
  const referencia = centroide(torso);

  SILUETAS[`${forma.id}/torso`] = centrar(torso);

  const cabeza = forma.getPart("cabeza").sides[0].points;
  const ojos = forma.getPart("ojos").sides.map((lado) => lado.points);
  SILUETAS[`${forma.id}/cabeza`] = normalizar(cabeza, ojos, referencia);

  // Se toma un solo brazo y un solo antebrazo: el derecho es el espejo.
  SILUETAS[`${forma.id}/brazo`] = normalizar(
    forma.getPart("brazo").sides[0].points,
    [],
    referencia
  );
  SILUETAS[`${forma.id}/antebrazo`] = normalizar(
    forma.getPart("antebrazo").sides[0].points,
    [],
    referencia
  );
}

/** Silueta por nombre, por ejemplo "forma-1/torso". */
export function getSilueta(nombre) {
  const silueta = SILUETAS[nombre];
  if (!silueta) {
    throw new Error(`No existe la silueta "${nombre}"`);
  }
  return silueta;
}

/** Nombres disponibles, útil para pruebas y depuración. */
export const NOMBRES_SILUETAS = congelarProfundo(Object.keys(SILUETAS));
