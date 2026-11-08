// ============================================================
// canonical.js
//
// Convierte una lista de partes (los números fijos de una canónica
// o los valores al azar de un genoma) en puntos listos para dibujar.
//
// Dos formas de colocar una parte:
//
//   1. COMPOSICIÓN ORIGINAL: si la parte es "de origen" y cuelga del
//      núcleo, se coloca donde estaba en el dibujo (su "home"),
//      escalado junto con el torso. Así el organismo se ve como el SVG.
//
//   2. CADENA: si cuelga de otra parte (un antebrazo de un brazo),
//      sale de la PUNTA del padre y continúa su dirección.
//
// Tipos de forma base:
//   - "esfera"  → usa radius (RADIO, no diámetro)
//   - "silueta" → usa width y height (ancho y alto máximos)
// ============================================================

import { crearEsfera, crearSilueta } from "./baseShapes.js";
import { getSilueta } from "./silhouettes.js";

const GENERADORES = {
  esfera: (parte) => crearEsfera({ radio: parte.radius }),
  silueta: (parte, slot) => crearSilueta(getSilueta(slot.silhouette), parte.width, parte.height),
};

/**
 * Construye la forma completa de una familia a partir de una lista
 * de partes con los valores ya decididos.
 */
export function construirForma(familia, partes) {
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((c) => [c.child, c]));

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
    let origen = { x: 0, y: 0 };

    const conexion = conexionPorHijo.get(slot.id);
    const siluetaHija = slot.silhouette ? getSilueta(slot.silhouette) : null;

    if (conexion) {
      const padre = construidas.get(conexion.parent);
      if (!padre) {
        throw new Error(
          `La parte "${slot.id}" necesita que "${conexion.parent}" esté antes en la lista.`
        );
      }

      const angulo = parte.angle ?? 0;
      const radianes = gradosARadianes(angulo);
      const giro = radianes - construido.direccion;

      const slotPadre = slotsPorId.get(conexion.parent);
      const siluetaPadre = slotPadre?.silhouette ? getSilueta(slotPadre.silhouette) : null;

      if (slotPadre?.role === "nucleo" && siluetaHija && slot.origen) {
        // Composición original: el punto de unión escalado con el torso.
        const cajaPadre = calcularBounds([padre.points]);
        const escalaX = cajaPadre.width / siluetaPadre.tamano.width;
        const escalaY = cajaPadre.height / siluetaPadre.tamano.height;

        origen = {
          x: siluetaHija.home.x * escalaX,
          y: siluetaHija.home.y * escalaY,
        };
      } else {
        // Cadena: sale de la punta del padre.
        const punta = puntoDeBorde(padre.points, angulo);
        const hundido = calcularHundido(parte);

        origen = {
          x: punta.x - Math.cos(radianes) * hundido,
          y: punta.y - Math.sin(radianes) * hundido,
        };
      }

      points = rotarYTrasladar(points, giro, origen.x, origen.y);
      extras = extras.map((extra) => rotarYTrasladar(extra, giro, origen.x, origen.y));
    } else {
      // El núcleo no cuelga de nadie: se centra en el origen.
      const centro = centroideDe(points);
      points = trasladar(points, -centro.x, -centro.y);
      extras = extras.map((extra) => trasladar(extra, -centro.x, -centro.y));
    }

    const construida = {
      id: slot.id,
      role: slot.role,
      anchor: slot.anchor,
      // Quién es su padre: sirve para que la pose respete la jerarquía.
      parent: conexion?.parent ?? null,
      origen,
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
    bounds: calcularBounds(resultado.map((parte) => parte.points)),
  };
}

/** La forma canónica de una familia: la muestra fija que usa la galería. */
export function construirCanonica(familia) {
  return construirForma(familia, familia.canonical.parts);
}

// ------------------------------------------------------------
// Ayudas de geometría
// ------------------------------------------------------------

/** Cuánto se hunde la parte dentro de su padre para tapar la costura. */
function calcularHundido(parte) {
  if (typeof parte.radius === "number") return parte.radius * 0.2;
  if (typeof parte.width === "number") return parte.width * 0.1;
  return 0;
}

/**
 * Punto del borde en una dirección.
 * Si el borde es recto, devuelve el MEDIO del borde (promedia los
 * puntos que empatan en la proyección máxima), no una esquina.
 */
function puntoDeBorde(puntos, anguloGrados) {
  const radianes = gradosARadianes(anguloGrados);
  const dx = Math.cos(radianes);
  const dy = Math.sin(radianes);

  let maximo = -Infinity;
  let minimo = Infinity;

  for (const punto of puntos) {
    const proyeccion = punto.x * dx + punto.y * dy;
    if (proyeccion > maximo) maximo = proyeccion;
    if (proyeccion < minimo) minimo = proyeccion;
  }

  const tolerancia = Math.max(0.001, (maximo - minimo) * 0.005);

  let sumaX = 0;
  let sumaY = 0;
  let cantidad = 0;

  for (const punto of puntos) {
    if (punto.x * dx + punto.y * dy >= maximo - tolerancia) {
      sumaX += punto.x;
      sumaY += punto.y;
      cantidad++;
    }
  }

  return { x: sumaX / cantidad, y: sumaY / cantidad };
}

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

/** Caja que ocupa una lista de puntos. */
function calcularBounds(listasDePuntos) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const puntos of listasDePuntos) {
    for (const punto of puntos) {
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
