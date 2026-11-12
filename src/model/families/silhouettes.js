// ============================================================
// silhouettes.js
//
// Biblioteca de SILUETAS sacadas de los SVG de archivossvg/.
// Es el vocabulario de formas de las familias: torso, cabeza,
// brazos y antebrazos de cada dibujo.
//
// Cada silueta se guarda NORMALIZADA:
//   - su punto de unión queda en (0, 0),
//   - "direccion" dice hacia dónde apuntaba la parte en el dibujo,
//   - "home" dice DÓNDE estaba ese punto de unión respecto del centro
//     del torso. Es lo que permite reconstruir la composición original:
//     brazos y antebrazos vuelven al lugar donde los dibujaste.
//   - "tamano" es la caja original, para escalar el "home" junto con
//     el torso.
//
// Se guardan los DOS lados (izquierdo y derecho) porque el dibujo los
// tiene a ambos lados del cuerpo.
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

function caja(puntos) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const punto of puntos) {
    if (punto.x < minX) minX = punto.x;
    if (punto.y < minY) minY = punto.y;
    if (punto.x > maxX) maxX = punto.x;
    if (punto.y > maxY) maxY = punto.y;
  }

  return { width: maxX - minX, height: maxY - minY };
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
 * el punto más cercano a la referencia pasa a (0, 0), se guarda la
 * dirección en la que se aleja y el lugar donde estaba en el dibujo.
 */
function normalizar(puntos, ojos, referencia) {
  const anclaje = puntoMasCercano(puntos, referencia);
  const centro = centroide(puntos);

  return congelarProfundo({
    puntos: trasladar(puntos, -anclaje.x, -anclaje.y),
    // Los ojos viajan en el mismo sistema de coordenadas que su cabeza.
    ojos: ojos.map((ojo) => trasladar(ojo, -anclaje.x, -anclaje.y)),
    direccion: Math.atan2(centro.y - anclaje.y, centro.x - anclaje.x),
    home: { x: anclaje.x - referencia.x, y: anclaje.y - referencia.y },
    tamano: caja(puntos),
  });
}

/** El núcleo se guarda centrado en (0, 0), sin punto de unión. */
function centrar(puntos) {
  const centro = centroide(puntos);

  return congelarProfundo({
    puntos: trasladar(puntos, -centro.x, -centro.y),
    ojos: [],
    direccion: 0,
    home: { x: 0, y: 0 },
    tamano: caja(puntos),
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

  const brazos = forma.getPart("brazo").sides;
  const antebrazos = forma.getPart("antebrazo").sides;

  SILUETAS[`${forma.id}/brazo-izquierda`] = normalizar(brazos[0].points, [], referencia);
  SILUETAS[`${forma.id}/brazo-derecha`] = normalizar(
    brazos[brazos.length - 1].points,
    [],
    referencia
  );

  SILUETAS[`${forma.id}/antebrazo-izquierda`] = normalizar(
    antebrazos[0].points,
    [],
    referencia
  );
  SILUETAS[`${forma.id}/antebrazo-derecha`] = normalizar(
    antebrazos[antebrazos.length - 1].points,
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
