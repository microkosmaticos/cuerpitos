// ============================================================
// aplicarPose.js
//
// Aplica la pose viva a los puntos del genoma PARA DIBUJAR.
// Nunca modifica el genoma: devuelve puntos nuevos.
//
// JERARQUÍA: si un brazo gira, sus antebrazos lo acompañan. Por eso
// cada parte se transforma en dos etapas:
//   1. se aplica la cadena de sus padres (el hijo se mueve con ellos),
//   2. recién ahí se aplica su propia rotación alrededor de su origen
//      ya movido.
//
// La cabeza no tiene estado de pose: queda rígida con el torso.
// ============================================================

/**
 * @param {object} shape forma construida (cada parte trae "parent")
 * @param {object} pose estado devuelto por OrganismPose
 * @returns {object[]} partes con los puntos deformados y "origenActual"
 */
export function aplicarPose(shape, pose) {
  const porId = new Map(shape.parts.map((parte) => [parte.id, parte]));
  const cadenas = new Map();
  const resultado = [];

  for (const parte of shape.parts) {
    const estado = pose?.partes?.get(parte.id);
    const radio = radioDeLaParte(parte);

    // Cadena de transformaciones de los ancestros, de la raíz hacia acá.
    const cadenaPadre = parte.parent ? cadenas.get(parte.parent) ?? [] : [];

    // El origen de la parte se mueve con sus ancestros.
    const origenActual = aplicarCadena(parte.origen, cadenaPadre);

    // El nivel propio se agrega para que los hijos nos sigan.
    cadenas.set(parte.id, [
      ...cadenaPadre,
      {
        origen: origenActual,
        angulo: estado?.angulo ?? 0,
        escala: estado?.escala ?? 1,
      },
    ]);

    const transformar = (punto) =>
      aplicarPropia(aplicarCadena(punto, cadenaPadre), origenActual, estado, radio);

    resultado.push({
      ...parte,
      origenActual,
      points: parte.points.map(transformar),
      extras: (parte.extras ?? []).map((extra) => extra.map(transformar)),
    });
  }

  return resultado;
}

/** Aplica los niveles de los ancestros, del más lejano al más cercano. */
function aplicarCadena(punto, cadena) {
  let actual = punto;

  for (const nivel of cadena) {
    actual = rotarEscalar(actual, nivel.origen, nivel.angulo, nivel.escala);
  }

  return actual;
}

/** Rotación + curvatura + escala propias de la parte, sobre su origen actual. */
function aplicarPropia(punto, origen, estado, radio) {
  if (!estado) return punto;

  const dx = punto.x - origen.x;
  const dy = punto.y - origen.y;

  const distancia = Math.hypot(dx, dy);
  const factor = radio > 0 ? distancia / radio : 0;

  // La curvatura suma un giro que crece hacia la punta.
  const angulo = estado.angulo + estado.curvatura * factor;

  return rotarEscalar(punto, origen, angulo, estado.escala);
}

function rotarEscalar(punto, origen, angulo, escala) {
  const dx = (punto.x - origen.x) * escala;
  const dy = (punto.y - origen.y) * escala;

  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);

  return {
    x: origen.x + dx * cos - dy * sin,
    y: origen.y + dx * sin + dy * cos,
  };
}

function radioDeLaParte(parte) {
  let maximo = 0;

  for (const punto of parte.points) {
    const distancia = Math.hypot(punto.x - parte.origen.x, punto.y - parte.origen.y);
    if (distancia > maximo) maximo = distancia;
  }

  return maximo || 1;
}
