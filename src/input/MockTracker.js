// ============================================================
// MockTracker.js
//
// TRACKER FALSO. Produce frames con el mismo contrato que el
// tracking real, pero sin cámara. Sirve para desarrollar la pose
// mientras la otra persona hace MediaPipe.
//
// Cuando llegue el tracker real, se cambia solo la fuente: la pose,
// el vínculo y la vista no se enteran.
//
// MODOS
//   raton      el cursor (normalizado) es el centro; los anchors lo
//              siguen con retraso
//   lissajous  movimiento continuo y suave
//   dos        dos personas independientes
//   quieto     todo quieto, energy 0
//   perdida    la persona desaparece a los 3 segundos
//
// No usa Math.random(): tiene su propio SeededRandom, así las
// pruebas son reproducibles.
// ============================================================

import { SeededRandom } from "../model/random/SeededRandom.js";
import { validarFrame } from "../model/tracking/TrackingFrame.js";

export const MODOS = ["raton", "lissajous", "dos", "quieto", "perdida"];

const SEGUNDOS_HASTA_PERDER = 3;
const CONSTANTE_DEL_RATON = 0.12; // segundos: cuánto tarda en alcanzar el cursor

export class MockTracker {
  /**
   * @param {{ modo?: string, semilla?: number }} opciones
   */
  constructor({ modo = "lissajous", semilla = 1 } = {}) {
    this.rng = new SeededRandom(semilla);
    this.modo = MODOS.includes(modo) ? modo : "lissajous";
    this.tiempo = 0;

    // Fases sorteadas una sola vez: dan variedad entre semillas.
    this.faseA = this.rng.range(0, Math.PI * 2);
    this.faseB = this.rng.range(0, Math.PI * 2);

    // Estado del modo ratón.
    this.objetivo = { x: 0.5, y: 0.5 };
    this.raton = { x: 0.5, y: 0.5 };
  }

  /** Cambia de modo y reinicia el reloj (útil para "perdida"). */
  setModo(modo) {
    if (!MODOS.includes(modo)) {
      throw new Error(`Modo desconocido: "${modo}"`);
    }
    this.modo = modo;
    this.tiempo = 0;
  }

  /** Mueve el cursor virtual del modo "raton" (coordenadas 0..1). */
  moverA(x, y) {
    this.objetivo = { x, y };
  }

  /**
   * Avanza el mock y devuelve un frame válido.
   * @param {number} dt segundos transcurridos
   * @param {number} [ahora] timestamp en ms (por defecto, el interno)
   */
  update(dt = 1 / 60, ahora) {
    const paso = Math.min(0.1, Math.max(0, dt));
    this.tiempo += paso;

    const personas = this.construirPersonas(paso);

    return validarFrame({
      timestamp: ahora ?? this.tiempo * 1000,
      persons: personas,
    });
  }

  // ------------------------------------------------------------
  // Personas por modo
  // ------------------------------------------------------------

  construirPersonas(dt) {
    switch (this.modo) {
      case "raton":
        return [this.personaRaton(dt)];
      case "dos":
        return [
          this.personaLissajous("p0", this.faseA, 1),
          this.personaLissajous("p1", this.faseB, -1),
        ];
      case "quieto":
        return [this.personaQuieta("p0")];
      case "perdida":
        return [this.personaQueSePierde()];
      default:
        return [this.personaLissajous("p0", this.faseA, 1)];
    }
  }

  /** Persona que se mueve en curvas suaves. */
  personaLissajous(id, fase, sentido = 1) {
    const t = this.tiempo;

    const x = 0.5 + 0.16 * Math.sin(t * 0.7 + fase);
    const y = 0.52 + 0.1 * Math.sin(t * 1.1 + fase * 1.7);

    // Energía analítica: no depende de los fps.
    const energy = acotar(0.55 + 0.25 * Math.sin(t * 0.9 + fase), 0, 1);

    const vx = 0.16 * 0.7 * Math.cos(t * 0.7 + fase) * sentido;
    const vy = 0.1 * 1.1 * Math.cos(t * 1.1 + fase * 1.7);

    return this.personaConEsqueleto(id, x, y, {
      energy,
      spread: 0.6,
      vx,
      vy,
      wiggle: 0.022,
    });
  }

  /** Persona que sigue el cursor con retraso. */
  personaRaton(dt) {
    const alfa = 1 - Math.exp(-dt / CONSTANTE_DEL_RATON);

    this.raton.x += (this.objetivo.x - this.raton.x) * alfa;
    this.raton.y += (this.objetivo.y - this.raton.y) * alfa;

    const distancia = Math.hypot(this.objetivo.x - this.raton.x, this.objetivo.y - this.raton.y);

    return this.personaConEsqueleto("p0", this.raton.x, this.raton.y, {
      // Si el cursor se queda quieto, la energía cae a 0.
      energy: acotar(distancia * 6, 0, 1),
      spread: 0.5,
      vx: 0,
      vy: 0,
      wiggle: 0,
    });
  }

  /** Persona completamente quieta. */
  personaQuieta(id) {
    return this.personaConEsqueleto(id, 0.5, 0.52, {
      energy: 0,
      spread: 0.5,
      vx: 0,
      vy: 0,
      wiggle: 0,
    });
  }

  /** Persona que está y después se pierde. */
  personaQueSePierde() {
    const presente = this.tiempo < SEGUNDOS_HASTA_PERDER;

    const persona = this.personaLissajous("p0", this.faseA, 1);

    if (presente) return persona;

    return {
      ...persona,
      present: false,
      confidence: 0.1,
      energy: 0,
      anchors: persona.anchors.map(() => null),
    };
  }

  // ------------------------------------------------------------
  // Esqueleto normalizado alrededor de un centro
  // ------------------------------------------------------------

  /**
   * Arma los 7 anchors como un esqueleto de cintura hacia arriba.
   * Los offsets son fijos; el wiggle agrega una ondulación suave.
   */
  personaConEsqueleto(id, x, y, { energy, spread, vx, vy, wiggle }) {
    const t = this.tiempo;

    const offsets = [
      { dx: -0.09, dy: -0.07 }, // 0 hombro izquierdo
      { dx: 0.09, dy: -0.07 }, //  1 hombro derecho
      { dx: -0.13, dy: 0.07 }, //  2 codo izquierdo
      { dx: 0.13, dy: 0.07 }, //   3 codo derecho
      { dx: -0.15, dy: 0.2 }, //   4 muñeca izquierda
      { dx: 0.15, dy: 0.2 }, //    5 muñeca derecha
      { dx: 0, dy: 0.16 }, //      6 cintura
    ];

    const anchors = offsets.map((offset, indice) => {
      const ondulacion = wiggle === 0 ? 0 : wiggle * Math.sin(t * 2.1 + indice);
      const velocidadOndulacion =
        wiggle === 0 ? 0 : wiggle * 2.1 * Math.cos(t * 2.1 + indice);

      return {
        x: x + offset.dx * (0.8 + spread * 0.4) + ondulacion,
        y: y + offset.dy * (0.8 + spread * 0.4),
        vx: acotar(vx + velocidadOndulacion, -1, 1),
        vy: acotar(vy + velocidadOndulacion, -1, 1),
        confidence: 0.95,
      };
    });

    return {
      id,
      present: true,
      confidence: 0.95,
      center: { x, y },
      energy,
      spread,
      anchors,
    };
  }
}

function acotar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}
