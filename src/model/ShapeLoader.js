// ============================================================
// ShapeLoader.js
//
// Convierte los datos crudos de shapes.data.js en ShapeDefinition
// dibujables. El trabajo pesado es convertir los <path> de los SVG
// (curvas Bézier) en LISTAS DE PUNTOS.
//
// Por qué listas de puntos: con puntos podemos escalar, mover y
// deformar cualquier parte del organismo. Un path cerrado no se
// deforma tan fácil.
//
// Este archivo NO usa p5 ni el navegador: es lógica pura, así se
// puede probar con Node.
// ============================================================

import { ShapeDefinition } from "./ShapeDefinition.js";

// Cuántos puntos generamos por cada curva. Más puntos = más suave.
const PASOS_CURVA = 16;
// Cuántos puntos generamos por círculo completo.
const PASOS_CIRCULO = 64;
// Cuántos puntos por esquina redondeada de un rectángulo.
const PASOS_ESQUINA = 8;

/**
 * Carga todas las formas del archivo de datos.
 * @param {object[]} datos lista de formas crudas
 * @returns {ShapeDefinition[]}
 */
export function loadShapes(datos) {
  return datos.map(loadShape);
}

/**
 * Carga una sola forma.
 * @param {object} datos forma cruda de shapes.data.js
 * @returns {ShapeDefinition}
 */
export function loadShape(datos) {
  const parts = datos.parts.map((part) => {
    const visible = part.visible !== false;

    // Cada ítem (path, círculo, rect...) se convierte en puntos.
    const geometrias = part.items.map((item) => {
      const points = puntosDeItem(item);
      return { color: item.color, points, centroX: promedioX(points) };
    });

    return {
      name: part.name,
      visible,
      sides: armarLados(geometrias),
    };
  });

  return new ShapeDefinition({
    id: datos.id,
    name: datos.name,
    source: datos.source,
    viewBox: datos.viewBox,
    parts,
  });
}

// ------------------------------------------------------------
// Separar izquierda / derecha
// ------------------------------------------------------------

/**
 * Un grupo con un solo ítem queda como "center".
 * Un grupo con dos ítems se ordena por posición horizontal:
 * el de menor X promedio es el izquierdo.
 *
 * Esto es lo que separa los dos brazos y los dos antebrazos,
 * sin depender del orden en que estén escritos en el SVG.
 */
function armarLados(geometrias) {
  if (geometrias.length === 0) return [];
  if (geometrias.length === 1) {
    return [{ side: "center", color: geometrias[0].color, points: geometrias[0].points }];
  }

  const ordenadas = [...geometrias].sort((a, b) => a.centroX - b.centroX);
  const izquierda = ordenadas[0];
  const derecha = ordenadas[ordenadas.length - 1];

  return [
    { side: "left", color: izquierda.color, points: izquierda.points },
    { side: "right", color: derecha.color, points: derecha.points },
  ];
}

function promedioX(points) {
  if (points.length === 0) return 0;
  let suma = 0;
  for (const punto of points) suma += punto.x;
  return suma / points.length;
}

// ------------------------------------------------------------
// Primitivas: se generan directamente, sin leer curvas
// ------------------------------------------------------------

function puntosDeItem(item) {
  let puntos;

  if (item.kind === "path") puntos = aplanarPath(item.d);
  else if (item.kind === "circle") puntos = puntosElipse(item.cx, item.cy, item.r, item.r);
  else if (item.kind === "ellipse") puntos = puntosElipse(item.cx, item.cy, item.rx, item.ry);
  else if (item.kind === "rect") puntos = puntosRect(item);
  else throw new Error(`Tipo de forma desconocido: ${item.kind}`);

  // Algunos elementos del SVG vienen rotados o desplazados
  // (por ejemplo, los ojos del personaje 2).
  return item.transform ? aplicarTransform(puntos, item.transform) : puntos;
}

// ------------------------------------------------------------
// Transformaciones del SVG (translate / rotate / scale)
// ------------------------------------------------------------

/**
 * Aplica un atributo transform de SVG a una lista de puntos.
 * En SVG la última operación de la lista se aplica primero,
 * por eso recorremos las operaciones al revés.
 */
function aplicarTransform(puntos, transform) {
  const operaciones = [];
  const regex = /(translate|rotate|scale)\(([^)]*)\)/g;
  let coincidencia;

  while ((coincidencia = regex.exec(transform)) !== null) {
    operaciones.push({
      tipo: coincidencia[1],
      valores: coincidencia[2].trim().split(/[\s,]+/).map(Number),
    });
  }

  let resultado = puntos;
  for (let i = operaciones.length - 1; i >= 0; i--) {
    resultado = aplicarOperacion(resultado, operaciones[i]);
  }
  return resultado;
}

function aplicarOperacion(puntos, operacion) {
  if (operacion.tipo === "translate") {
    const [tx, ty = 0] = operacion.valores;
    return puntos.map((p) => ({ x: p.x + tx, y: p.y + ty }));
  }

  if (operacion.tipo === "scale") {
    const [sx, sy = sx] = operacion.valores;
    return puntos.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  }

  // rotate(ángulo) gira sobre el origen; rotate(ángulo cx cy) sobre un punto.
  const [angulo, cx = 0, cy = 0] = operacion.valores;
  const radianes = (angulo * Math.PI) / 180;
  const cos = Math.cos(radianes);
  const sin = Math.sin(radianes);

  return puntos.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  });
}

function puntosElipse(cx, cy, rx, ry) {
  const puntos = [];
  for (let i = 0; i < PASOS_CIRCULO; i++) {
    const angulo = (Math.PI * 2 * i) / PASOS_CIRCULO;
    puntos.push({ x: cx + rx * Math.cos(angulo), y: cy + ry * Math.sin(angulo) });
  }
  return puntos;
}

function puntosRect(item) {
  const { x, y, width: w, height: h } = item;
  const rx = Math.min(item.rx || 0, w / 2);
  const ry = Math.min(item.ry || rx, h / 2);

  // Sin esquinas redondeadas: son cuatro puntos.
  if (rx <= 0 || ry <= 0) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }

  const puntos = [];
  // Las cuatro esquinas, en sentido horario, cada una con su ángulo inicial.
  const esquinas = [
    { cx: x + w - rx, cy: y + ry, inicio: -Math.PI / 2 },
    { cx: x + w - rx, cy: y + h - ry, inicio: 0 },
    { cx: x + rx, cy: y + h - ry, inicio: Math.PI / 2 },
    { cx: x + rx, cy: y + ry, inicio: Math.PI },
  ];

  for (const esquina of esquinas) {
    for (let i = 0; i <= PASOS_ESQUINA; i++) {
      const angulo = esquina.inicio + (Math.PI / 2) * (i / PASOS_ESQUINA);
      puntos.push({
        x: esquina.cx + rx * Math.cos(angulo),
        y: esquina.cy + ry * Math.sin(angulo),
      });
    }
  }

  return puntos;
}

// ------------------------------------------------------------
// Aplanar un path SVG en puntos
// ------------------------------------------------------------

// Cuántos números necesita cada comando.
const CANTIDAD_ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

function tokenizarPath(d) {
  const tokens = [];
  const regex = /([MmLlHhVvCcSsQqTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let coincidencia;

  while ((coincidencia = regex.exec(d)) !== null) {
    if (coincidencia[1]) {
      tokens.push({ tipo: "comando", valor: coincidencia[1] });
    } else {
      tokens.push({ tipo: "numero", valor: parseFloat(coincidencia[2]) });
    }
  }

  return tokens;
}

/**
 * Convierte el atributo "d" de un <path> en puntos.
 * Soporta M, L, H, V, C, S, Q, T y Z, en forma absoluta y relativa.
 * Los arcos (A) no se usan en estos SVG.
 */
function aplanarPath(d) {
  const tokens = tokenizarPath(d);
  const puntos = [];

  let i = 0;
  let comandoPrevio = null;
  let tipoPrevio = null;
  let controlPrevio = null;

  let cx = 0;
  let cy = 0;
  let inicioX = 0;
  let inicioY = 0;

  while (i < tokens.length) {
    const indiceAntes = i;
    let comando;

    if (tokens[i].tipo === "comando") {
      comando = tokens[i].valor;
      i++;
    } else if (comandoPrevio) {
      // Coordenadas sin comando explícito: se repite el comando anterior.
      // Después de M/m, los pares siguientes se leen como líneas L/l.
      if (CANTIDAD_ARGS[comandoPrevio.toUpperCase()] === 0) {
        throw new Error(`Path SVG inválido: ${d.slice(0, 40)}...`);
      }
      if (comandoPrevio === "M") comando = "L";
      else if (comandoPrevio === "m") comando = "l";
      else comando = comandoPrevio;
    } else {
      throw new Error(`Path SVG inválido: ${d.slice(0, 40)}...`);
    }

    const mayuscula = comando.toUpperCase();
    const relativo = comando !== mayuscula;
    const cantidad = CANTIDAD_ARGS[mayuscula];

    const args = [];
    for (let k = 0; k < cantidad; k++) {
      const token = tokens[i];
      if (!token || token.tipo !== "numero") {
        throw new Error(`Faltan coordenadas en el path: ${d.slice(0, 40)}...`);
      }
      args.push(token.valor);
      i++;
    }

    switch (mayuscula) {
      case "M": {
        cx = relativo ? cx + args[0] : args[0];
        cy = relativo ? cy + args[1] : args[1];
        inicioX = cx;
        inicioY = cy;
        puntos.push({ x: cx, y: cy });
        controlPrevio = null;
        break;
      }

      case "L": {
        cx = relativo ? cx + args[0] : args[0];
        cy = relativo ? cy + args[1] : args[1];
        puntos.push({ x: cx, y: cy });
        controlPrevio = null;
        break;
      }

      case "H": {
        cx = relativo ? cx + args[0] : args[0];
        puntos.push({ x: cx, y: cy });
        controlPrevio = null;
        break;
      }

      case "V": {
        cy = relativo ? cy + args[0] : args[0];
        puntos.push({ x: cx, y: cy });
        controlPrevio = null;
        break;
      }

      case "C": {
        const x1 = relativo ? cx + args[0] : args[0];
        const y1 = relativo ? cy + args[1] : args[1];
        const x2 = relativo ? cx + args[2] : args[2];
        const y2 = relativo ? cy + args[3] : args[3];
        const x3 = relativo ? cx + args[4] : args[4];
        const y3 = relativo ? cy + args[5] : args[5];

        muestrearCubica(
          puntos,
          { x: cx, y: cy },
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          { x: x3, y: y3 }
        );

        controlPrevio = { x: x2, y: y2 };
        cx = x3;
        cy = y3;
        break;
      }

      case "S": {
        const x2 = relativo ? cx + args[0] : args[0];
        const y2 = relativo ? cy + args[1] : args[1];
        const x3 = relativo ? cx + args[2] : args[2];
        const y3 = relativo ? cy + args[3] : args[3];

        // El primer punto de control es el reflejo del anterior
        // si el segmento previo también fue una curva.
        const reflejar = (tipoPrevio === "C" || tipoPrevio === "S") && controlPrevio;
        const c1 = reflejar
          ? { x: 2 * cx - controlPrevio.x, y: 2 * cy - controlPrevio.y }
          : { x: cx, y: cy };

        muestrearCubica(puntos, { x: cx, y: cy }, c1, { x: x2, y: y2 }, { x: x3, y: y3 });

        controlPrevio = { x: x2, y: y2 };
        cx = x3;
        cy = y3;
        break;
      }

      case "Q": {
        const x1 = relativo ? cx + args[0] : args[0];
        const y1 = relativo ? cy + args[1] : args[1];
        const x2 = relativo ? cx + args[2] : args[2];
        const y2 = relativo ? cy + args[3] : args[3];

        muestrearCuadratica(puntos, { x: cx, y: cy }, { x: x1, y: y1 }, { x: x2, y: y2 });

        controlPrevio = { x: x1, y: y1 };
        cx = x2;
        cy = y2;
        break;
      }

      case "T": {
        const x2 = relativo ? cx + args[0] : args[0];
        const y2 = relativo ? cy + args[1] : args[1];

        const reflejar = (tipoPrevio === "Q" || tipoPrevio === "T") && controlPrevio;
        const c1 = reflejar
          ? { x: 2 * cx - controlPrevio.x, y: 2 * cy - controlPrevio.y }
          : { x: cx, y: cy };

        muestrearCuadratica(puntos, { x: cx, y: cy }, c1, { x: x2, y: y2 });

        controlPrevio = { x: c1.x, y: c1.y };
        cx = x2;
        cy = y2;
        break;
      }

      case "Z": {
        // Cerrar: volvemos al inicio. El p5 `endShape(CLOSE)` une el último
        // punto con el primero, así que no hace falta duplicarlo acá.
        cx = inicioX;
        cy = inicioY;
        controlPrevio = null;
        break;
      }
    }

    tipoPrevio = mayuscula;
    comandoPrevio = comando;

    // Red de seguridad: si el índice no avanzó, algo está mal y
    // el while se colgaría para siempre.
    if (i === indiceAntes) {
      throw new Error(`Path SVG inválido: ${d.slice(0, 40)}...`);
    }
  }

  return puntos;
}

function muestrearCubica(puntos, p0, p1, p2, p3) {
  for (let paso = 1; paso <= PASOS_CURVA; paso++) {
    const t = paso / PASOS_CURVA;
    const u = 1 - t;
    puntos.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
}

function muestrearCuadratica(puntos, p0, p1, p2) {
  for (let paso = 1; paso <= PASOS_CURVA; paso++) {
    const t = paso / PASOS_CURVA;
    const u = 1 - t;
    puntos.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
}
