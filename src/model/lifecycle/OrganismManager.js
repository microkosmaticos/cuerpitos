// ============================================================
// OrganismManager.js
//
// GESTOR DEL CICLO DE VIDA. Mantiene hasta dos espacios, empareja
// persona ↔ organismo por el id del tracker y aplica:
//   - la condición de nacimiento (puedeNacer)
//   - la histéresis (confirmación para nacer, gracia para no morir)
//   - las transiciones de presencia (nacimiento y desaparición)
//
// Devuelve en cada actualización:
//   { organismos, eventos, pendientes }
//
// Los eventos ("nacio", "empezo-a-desvanecerse", "desaparecio") son
// el gancho para el sonido y las interacciones: todavía no se usan.
//
// Todo avanza en PASOS FIJOS de 1/120 s con un acumulador, así 30 y
// 60 fps dan los mismos tiempos.
// ============================================================

import { CICLO } from "../../config/ciclo.js";
import { ESTADOS } from "./estados.js";
import { puedeNacer } from "./puedeNacer.js";
import { bornOrganism } from "../genome/bornOrganism.js";

/** Paso fijo de simulación, en segundos. */
export const PASO_FIJO = 1 / 120;

export class OrganismManager {
  /**
   * @param {object} opciones
   * @param {Function|null} opciones.fuenteDeSemillas devuelve la semilla siguiente
   * @param {Function} opciones.crearOrganismo crea el organismo a partir de una semilla
   * @param {object} opciones.config configuración del ciclo
   */
  constructor({
    fuenteDeSemillas = null,
    crearOrganismo = (semilla) => bornOrganism(semilla),
    config = CICLO,
  } = {}) {
    this.fuenteDeSemillas = fuenteDeSemillas;
    this.crearOrganismo = crearOrganismo;
    this.config = config;

    this.espacios = [];
    this.pendientes = new Map(); // personaId → segundos válidos acumulados
    this.acumulador = 0;
  }

  /** Semilla para un organismo nuevo. Sin fuente, la inventa bornOrganism. */
  semillaSiguiente() {
    return this.fuenteDeSemillas ? this.fuenteDeSemillas() : undefined;
  }

  /**
   * Avanza el ciclo.
   * @param {number} dt segundos
   * @param {object} frame frame de tracking ya validado
   */
  update(dt, frame) {
    this.acumulador += Math.min(0.1, Math.max(0, dt));

    const eventos = [];
    let vueltas = 0;

    while (this.acumulador >= PASO_FIJO && vueltas < 240) {
      this.paso(PASO_FIJO, frame, eventos);
      this.acumulador -= PASO_FIJO;
      vueltas++;
    }

    return {
      organismos: this.espacios.map((espacio) => ({
        organismo: espacio.organismo,
        personaId: espacio.personaId,
        estado: espacio.estado,
        presencia: espacio.presencia,
        tiempoSinPresencia: espacio.tiempoSinPresencia,
      })),
      pendientes: [...this.pendientes.entries()].map(([personaId, tiempo]) => ({
        personaId,
        tiempo,
      })),
      eventos,
    };
  }

  // ------------------------------------------------------------
  // Un paso de simulación
  // ------------------------------------------------------------

  paso(paso, frame, eventos) {
    const personas = frame?.persons ?? [];
    const porId = new Map(personas.map((persona) => [persona.id, persona]));

    // 1. Avanzar cada espacio.
    for (const espacio of this.espacios) {
      const persona = porId.get(espacio.personaId) ?? null;
      const presente = Boolean(persona && persona.present);

      espacio.tiempoSinPresencia = presente ? 0 : espacio.tiempoSinPresencia + paso;

      // La gracia: recién después de este tiempo empieza a irse.
      const esperando =
        espacio.estado === ESTADOS.NACIENDO || espacio.estado === ESTADOS.VIVO;

      if (esperando && espacio.tiempoSinPresencia > this.config.gracia) {
        espacio.estado = ESTADOS.DESVANECIENDO;
        eventos.push(crearEvento("empezo-a-desvanecerse", espacio));
      }

      if (espacio.estado === ESTADOS.NACIENDO) {
        espacio.presencia = Math.min(
          1,
          espacio.presencia + paso / this.config.nacimiento
        );
        if (espacio.presencia >= 1) espacio.estado = ESTADOS.VIVO;
      } else if (espacio.estado === ESTADOS.VIVO) {
        espacio.presencia = 1;
      } else if (espacio.estado === ESTADOS.DESVANECIENDO) {
        espacio.presencia = Math.max(
          0,
          espacio.presencia - paso / this.config.desaparicion
        );
        if (espacio.presencia <= 0) {
          espacio.estado = ESTADOS.DESAPARECIDO;
          eventos.push(crearEvento("desaparecio", espacio));
        }
      }
    }

    // 2. Eliminar los que terminaron de desaparecer.
    this.espacios = this.espacios.filter(
      (espacio) => espacio.estado !== ESTADOS.DESAPARECIDO
    );

    // 3. Personas válidas sin espacio: confirmación y nacimiento.
    const conEspacio = new Set(this.espacios.map((espacio) => espacio.personaId));
    const validas = new Set();

    for (const persona of personas.slice(0, this.config.maximoDeOrganismos)) {
      if (conEspacio.has(persona.id)) continue;
      if (!puedeNacer(persona, this.config)) continue;

      validas.add(persona.id);

      const acumulado = (this.pendientes.get(persona.id) ?? 0) + paso;
      this.pendientes.set(persona.id, acumulado);

      if (acumulado < this.config.confirmacion) continue;
      if (this.espacios.length >= this.config.maximoDeOrganismos) continue;

      const organismo = this.crearConPaletaDistinta();
      const espacio = {
        personaId: persona.id,
        organismo,
        estado: ESTADOS.NACIENDO,
        presencia: 0,
        tiempoSinPresencia: 0,
      };

      this.espacios.push(espacio);
      this.pendientes.delete(persona.id);
      eventos.push(crearEvento("nacio", espacio));
    }

    // 4. Los que dejaron de ser válidos pierden su acumulado.
    for (const id of [...this.pendientes.keys()]) {
      if (!validas.has(id)) this.pendientes.delete(id);
    }
  }

  // ------------------------------------------------------------
  // Creación con paleta distinta
  // ------------------------------------------------------------

  /**
   * Crea un organismo evitando la paleta de otro activo.
   * Prueba hasta `intentosDePaleta` semillas. Si no lo logra,
   * se queda con la última: nunca se bloquea el nacimiento.
   */
  crearConPaletaDistinta() {
    const paletasUsadas = new Set(
      this.espacios.map((espacio) => espacio.organismo.palette.familyId)
    );

    let candidato = this.crearOrganismo(this.semillaSiguiente());

    for (let intento = 1; intento < this.config.intentosDePaleta; intento++) {
      if (!paletasUsadas.has(candidato.palette.familyId)) break;
      candidato = this.crearOrganismo(this.semillaSiguiente());
    }

    return candidato;
  }
}

function crearEvento(tipo, espacio) {
  return {
    tipo,
    organismoId: espacio.organismo.id,
    semilla: espacio.organismo.seed,
    familia: espacio.organismo.familyId,
    paleta: espacio.organismo.palette.familyId,
  };
}
