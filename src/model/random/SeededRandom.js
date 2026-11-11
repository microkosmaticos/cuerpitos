// ============================================================
// SeededRandom.js
//
// Generador pseudoaleatorio REPRODUCIBLE.
//
// ¿QUÉ ES UNA SEMILLA?
// Es un número que arranca la secuencia de números al azar.
// El generador no es realmente aleatorio: es una fórmula que, a
// partir de la semilla, produce siempre la misma lista de números.
// Por eso decimos "pseudo"aleatorio.
//
// ¿POR QUÉ USAMOS SEMILLA Y NO Math.random()?
// Porque con Math.random() un organismo no se puede repetir nunca.
// Con semilla sí: la semilla 123 produce SIEMPRE el mismo organismo.
// Eso nos permite:
//   - volver a ver un organismo que nos gustó (?seed=123),
//   - reproducir un error,
//   - comparar variantes sin que cambie todo lo demás.
//
// El algoritmo es "mulberry32": chico, rápido y con buena
// distribución. Usa solo operaciones de enteros, así que da
// exactamente el mismo resultado en cualquier navegador o Node.
//
// IMPORTANTE: acá NO se usa Math.random(). La única semilla nueva
// que se crea al azar de verdad está en bornOrganism().
// ============================================================

// Constante del algoritmo. No se toca: es parte de la receta.
const MULTIPLICADOR = 0x6d2b79f5;

/**
 * Convierte cualquier semilla razonable en un entero de 32 bits.
 * Acepta números y textos numéricos (útil para ?seed=123 en la URL).
 */
function normalizarSemilla(seed) {
  const numero = typeof seed === "string" ? Number(seed) : seed;

  if (!Number.isFinite(numero)) {
    throw new TypeError(`La semilla tiene que ser un número y llegó: ${String(seed)}`);
  }

  // Math.abs + floor: una semilla negativa o con decimales también sirve,
  // pero siempre se trabaja con un entero positivo.
  return Math.floor(Math.abs(numero)) >>> 0;
}

export class SeededRandom {
  /**
   * @param {number|string} seed semilla inicial
   */
  constructor(seed) {
    /** La semilla ya normalizada. Se guarda para poder mostrarla. */
    this.seed = normalizarSemilla(seed);
    /** Estado interno: va cambiando en cada llamada a next(). */
    this.estado = this.seed;
  }

  /**
   * Devuelve el próximo número pseudoaleatorio entre 0 (incluido) y 1 (excluido).
   * Es la base de todos los demás métodos.
   */
  next() {
    // Avanza el estado. El | 0 lo mantiene como entero de 32 bits.
    this.estado = (this.estado + MULTIPLICADOR) | 0;

    // Mezcla los bits. Son las tres operaciones del algoritmo mulberry32.
    let t = Math.imul(this.estado ^ (this.estado >>> 15), 1 | this.estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    // Pasa el resultado a un número entre 0 y 1.
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Número decimal entre min (incluido) y max (excluido).
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new TypeError(`range() necesita números y recibió ${min}, ${max}`);
    }
    if (max < min) {
      throw new RangeError(`range(): el máximo (${max}) es menor que el mínimo (${min})`);
    }

    return min + (max - min) * this.next();
  }

  /**
   * Número entero entre min y max, AMBOS INCLUIDOS.
   * @param {number} min
   * @param {number} max
   */
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new TypeError(`int() necesita enteros y recibió ${min}, ${max}`);
    }
    if (max < min) {
      throw new RangeError(`int(): el máximo (${max}) es menor que el mínimo (${min})`);
    }

    // range() excluye el máximo, así que pedimos uno más y redondeamos abajo.
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Devuelve un elemento al azar de la lista.
   * @param {Array} lista
   */
  pick(lista) {
    if (!Array.isArray(lista) || lista.length === 0) {
      throw new TypeError("pick() necesita una lista con al menos un elemento");
    }

    return lista[this.int(0, lista.length - 1)];
  }
}
