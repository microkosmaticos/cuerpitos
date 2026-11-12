// ============================================================
// OrganismPose.js
//
// POSE VIVA de un organismo. Es el estado DINÁMICO: cambia en cada
// fotograma y no toca el genoma ni la paleta.
//
// Qué guarda:
//   - el desplazamiento del organismo (sigue al centro de su persona)
//   - por parte: ángulo, curvatura, escala y velocidad angular
//   - la señal (1 = tracking pleno, 0 = sin datos)
//
// Cómo se mueve:
//   - cada parte guarda una MEDIA LENTA del ÁNGULO de su ancla
//     alrededor del centro del cuerpo (MEMORIA_DE_ANCLA). El estímulo
//     es cuánto cambió ese ángulo: si la persona se traslada, el
//     ángulo relativo no cambia y la parte no se mueve. Si levanta un
//     brazo, el ángulo cambia y la parte lo acompaña.
//   - como el estímulo es un giro, la parte gira en el mismo sentido
//     sin importar hacia dónde apunta en reposo.
//   - el objetivo pasa por un filtro exponencial (retraso) y después
//     por un resorte amortiguado (rigidez/amortiguación).
//
// DELTA TIME: la física avanza en PASOS FIJOS de 1/120 s con un
// acumulador. Por eso 30 y 60 fps dan el mismo resultado: no importa
// cuántos frames llegaron, sino cuánto tiempo pasó.
// ============================================================

import { congelarProfundo } from "../families/deepFreeze.js";

/** Paso fijo de la simulación, en segundos. */
export const PASO_FIJO = 1 / 120;

/** Límites de deformación. Nunca se superan. */
export const LIMITES = congelarProfundo({
  angulo: 38, // grados
  curvatura: 0.16, // radianes de curvatura en la punta
  escala: 0.08, // ±8 %
  desplazamiento: 0.05, // ±5 % del lienzo
});

/** Debajo de esta energía todo se asienta en reposo. */
export const ZONA_MUERTA = 0.02;

/**
 * Con cualquier gesto, la respuesta arranca en este piso. Sin él, los
 * movimientos suaves quedaban casi invisibles aunque la persona se
 * estuviera moviendo.
 */
const PISO_DE_RESPUESTA = 0.4;

/** Constantes de tiempo, en segundos. */
const DECAIMIENTO_DE_SENAL = 0.8;
const RECUPERACION_DE_SENAL = 0.2;
const SUAVIZADO_DE_POSICION = 0.25;
const CONFIANZA_MINIMA = 0.3;

/**
 * Memoria lenta de la posición de cada ancla, en segundos.
 * Borra el vaivén lento (caminar) y deja los gestos.
 */
export const MEMORIA_DE_ANCLA = 1.2;

/** Debajo de esto se considera quieto y se congela en reposo. */
const QUIETO = 1e-3;

/**
 * Giro del ancla que se considera respuesta completa, en radianes.
 * Un brazo que gira ~29° alrededor del torso mueve la parte hasta el
 * límite (multiplicado por el temperamento de cada organismo).
 */
const ANGULO_DE_REFERENCIA = 0.5;

export class OrganismPose {
  /**
   * @param {object} shape forma construida (con origen y puntos)
   * @param {object} vinculos resultado de crearVinculos
   */
  constructor(shape, vinculos) {
    this.shape = shape;
    this.vinculos = new Map(vinculos.vinculos.map((v) => [v.partId, v]));

    this.posicion = { x: 0, y: 0 };
    this.senal = 1;
    this.estadoSenal = "ok";

    this.acumulador = 0;
    this.tiempo = 0;

    // Estado de cada parte.
    this.partes = new Map();
    for (const parte of shape.parts) {
      if (!this.vinculos.has(parte.id)) continue;
      this.partes.set(parte.id, {
        angulo: 0, // radianes, respecto del reposo
        objetivo: 0,
        velocidad: 0,
        // Media lenta del ángulo de su ancla (se inicializa al primer dato).
        mediaAngulo: null,
      });
    }

    // Por si la familia no tuviera partes móviles.
    this.estado = congelarProfundo(this.estadoVacio());
  }

  /**
   * Avanza la pose.
   * @param {number} dt segundos transcurridos
   * @param {object|null} persona persona de este organismo (o null)
   */
  update(dt, persona) {
    const paso = Math.min(0.1, Math.max(0, dt));
    this.acumulador += paso;

    // Se avanza en pasos fijos: mismo resultado a cualquier fps.
    let vueltas = 0;
    while (this.acumulador >= PASO_FIJO && vueltas < 60) {
      this.paso(PASO_FIJO, persona);
      this.acumulador -= PASO_FIJO;
      vueltas++;
    }

    this.actualizarEstado(persona);
    return this.estado;
  }

  // ------------------------------------------------------------
  // Un paso de simulación
  // ------------------------------------------------------------

  paso(paso, persona) {
    this.tiempo += paso;

    const haySenal = Boolean(persona && persona.present && persona.confidence >= CONFIANZA_MINIMA);

    // La señal se recupera despacio y cae suave.
    if (haySenal) {
      this.senal += (1 - this.senal) * (1 - Math.exp(-paso / RECUPERACION_DE_SENAL));
    } else {
      this.senal *= Math.exp(-paso / DECAIMIENTO_DE_SENAL);
    }

    const energia = haySenal ? intensidadDeEnergia(persona.energy) : 0;
    const intensidad = energia > 0
      ? (PISO_DE_RESPUESTA + (1 - PISO_DE_RESPUESTA) * energia) * this.senal
      : 0;

    // Posición del organismo: sigue al centro, atenuado y suavizado.
    const objetivoX = persona ? (persona.center.x - 0.5) * 2 * LIMITES.desplazamiento * this.senal : 0;
    const objetivoY = persona ? (persona.center.y - 0.5) * 2 * LIMITES.desplazamiento * this.senal : 0;

    const alfaPosicion = 1 - Math.exp(-paso / SUAVIZADO_DE_POSICION);
    this.posicion.x += (objetivoX - this.posicion.x) * alfaPosicion;
    this.posicion.y += (objetivoY - this.posicion.y) * alfaPosicion;

    // Cada parte, con su resorte.
    for (const [partId, estadoParte] of this.partes) {
      const vinculo = this.vinculos.get(partId);
      const ancla = persona?.anchors?.[vinculo.ancla] ?? null;

      let deseo = 0;

      if (ancla && haySenal) {
        const centro = persona.center ?? { x: 0.5, y: 0.5 };
        const anguloActual = Math.atan2(ancla.y - centro.y, ancla.x - centro.x);

        // La primera vez, la media arranca en el ángulo actual:
        // así no hay un tirón inicial.
        if (estadoParte.mediaAngulo === null) {
          estadoParte.mediaAngulo = anguloActual;
        }

        // Cuánto giró el ancla alrededor del cuerpo desde la media lenta.
        const giro = normalizarAngulo(anguloActual - estadoParte.mediaAngulo);

        const maximo = gradosARadianes(LIMITES.angulo);
        deseo = acotar(
          vinculo.ganancia * (giro / ANGULO_DE_REFERENCIA) * intensidad,
          -maximo,
          maximo
        );

        // La media se actualiza después de medir el giro.
        const alfaMedia = 1 - Math.exp(-paso / MEMORIA_DE_ANCLA);
        estadoParte.mediaAngulo = normalizarAngulo(
          estadoParte.mediaAngulo + giro * alfaMedia
        );
      }

      // 1. Retraso: filtro exponencial del objetivo.
      const retrasoEfectivo = vinculo.retraso * (1 + 0.5 * vinculo.fase);
      const alfa = 1 - Math.exp(-paso / retrasoEfectivo);
      estadoParte.objetivo += (deseo - estadoParte.objetivo) * alfa;

      // 2. Resorte amortiguado.
      const rigidez = vinculo.rigidez;
      const amortiguacion = 2 * Math.sqrt(rigidez) * vinculo.amortiguacion;

      const aceleracion =
        rigidez * (estadoParte.objetivo - estadoParte.angulo) -
        amortiguacion * estadoParte.velocidad;

      estadoParte.velocidad += aceleracion * paso;
      estadoParte.angulo += estadoParte.velocidad * paso;

      // 3. Límites duros.
      const maximo = gradosARadianes(LIMITES.angulo);
      if (estadoParte.angulo > maximo) {
        estadoParte.angulo = maximo;
        estadoParte.velocidad = 0;
      } else if (estadoParte.angulo < -maximo) {
        estadoParte.angulo = -maximo;
        estadoParte.velocidad = 0;
      }

      // 4. Reposo exacto: sin energía y casi quieto, se congela en 0.
      //    Evita un temblor numérico infinito.
      if (
        intensidad === 0 &&
        Math.abs(estadoParte.angulo) < QUIETO &&
        Math.abs(estadoParte.velocidad) < QUIETO
      ) {
        estadoParte.angulo = 0;
        estadoParte.objetivo = 0;
        estadoParte.velocidad = 0;
      }
    }
  }

  // ------------------------------------------------------------
  // Estado para dibujar
  // ------------------------------------------------------------

  actualizarEstado(persona) {
    const partes = new Map();
    const maximo = gradosARadianes(LIMITES.angulo);

    // Estado de señal, para que la próxima tarea sepa qué mostrar.
    if (!persona || !persona.present) {
      this.estadoSenal = "sin-senal";
    } else if (persona.confidence < CONFIANZA_MINIMA) {
      this.estadoSenal = "debil";
    } else {
      this.estadoSenal = "ok";
    }

    for (const [partId, estadoParte] of this.partes) {
      const proporcion = maximo === 0 ? 0 : estadoParte.angulo / maximo;

      // El pulso acompaña a la velocidad: respira cuando se mueve.
      const pulso = Math.min(1, Math.abs(estadoParte.velocidad) / 6);

      partes.set(partId, {
        angulo: estadoParte.angulo,
        curvatura: LIMITES.curvatura * proporcion * this.senal,
        escala: 1 + LIMITES.escala * pulso * this.senal,
      });
    }

    this.estado = congelarProfundo({
      posicion: { ...this.posicion },
      senal: this.senal,
      estadoSenal: this.estadoSenal,
      partes,
    });
  }

  estadoVacio() {
    return {
      posicion: { x: 0, y: 0 },
      senal: this.senal,
      estadoSenal: "sin-senal",
      partes: new Map(),
    };
  }
}

// ------------------------------------------------------------
// Ayudas
// ------------------------------------------------------------

/** Energía con zona muerta: debajo del umbral no hay movimiento. */
function intensidadDeEnergia(energy) {
  if (!(energy > ZONA_MUERTA)) return 0;
  return Math.min(1, (energy - ZONA_MUERTA) / (1 - ZONA_MUERTA));
}

function acotar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function gradosARadianes(grados) {
  return (grados * Math.PI) / 180;
}

/** Lleva un ángulo a (-π, π] para medir siempre el giro más corto. */
function normalizarAngulo(angulo) {
  let valor = angulo;
  while (valor > Math.PI) valor -= Math.PI * 2;
  while (valor <= -Math.PI) valor += Math.PI * 2;
  return valor;
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
