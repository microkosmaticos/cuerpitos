// ============================================================
// ExperienciaController.js
//
// EL CONTROLADOR de la experiencia final. Conecta, en este orden:
//
//   cámara → pose (ml5) → participantes → adaptador (contrato)
//            → ciclo de vida → comportamientos → pose viva → vista
//
// No sabe dibujar y no toca p5: recibe el frame ya convertido y
// entrega los organismos listos para que la vista los pinte.
//
// El camino real es push (el modelo avisa cuando hay poses); el
// camino de prueba es pull (MockTracker.update devuelve un frame).
// Los dos terminan en el mismo `ingestFrame`.
// ============================================================

import { Pose } from "../../pose.js";
import { crearVinculos, OrganismPose } from "../../bodies.js";

/** Si no llega ninguna pose en este tiempo, se asume que no hay señal. */
export const SIN_SENAL_MS = 2500;

/** Cuántos eventos de ciclo de vida se guardan para depuración. */
const MAX_EVENTOS = 40;

export class ExperienciaController {
  /**
   * @param {object} datos
   * @param {object} datos.manager OrganismManager
   * @param {object} datos.tracker ParticipantTracker
   * @param {object} datos.adapter TrackingAdapter
   * @param {object} datos.behaviors BehaviorBridge
   * @param {object|null} datos.view vista (opcional en pruebas)
   * @param {object|null} datos.camara CameraModel (para el fondo)
   * @param {Function} datos.reloj reloj en ms (inyectable)
   */
  constructor({
    manager,
    tracker,
    adapter,
    behaviors,
    view = null,
    camara = null,
    reloj = () => performance.now(),
  }) {
    this.manager = manager;
    this.tracker = tracker;
    this.adapter = adapter;
    this.behaviors = behaviors;
    this.view = view;
    this.camara = camara;
    this.reloj = reloj;

    this.poses = new Map();
    this.items = [];
    this.eventos = [];
    this.frame = adapter.update({ participants: [] }, 0);

    this.session = "SELECTING";
    this.participantes = 0;
    this.fps = 0;
    this.mensaje = null;
    this.error = false;

    // Diagnóstico para el HUD: qué ve el modelo y en qué anda.
    this.detecciones = 0;
    this.mejorConfianza = 0;
    this.candidatos = 0;
    this.energia = 0;
    this.anclas = 0;

    this.ultimoIngest = 0;
    this._frames = 0;
    this._ventana = 0;
  }

  // ------------------------------------------------------------
  // Entrada de datos
  // ------------------------------------------------------------

  /**
   * Camino real: poses crudas del modelo de ml5.
   * @param {object[]} posesCrudas
   * @param {number} ahora
   */
  ingestPoses(posesCrudas, ahora = this.reloj(), contar = true) {
    const poses = Array.isArray(posesCrudas)
      ? posesCrudas.filter(Boolean).map((cruda) => new Pose(cruda))
      : [];

    const resultado = this.tracker.update(poses, ahora);
    this.ingestFrame(this.adapter.update(resultado, ahora), ahora, resultado);

    this.detecciones = poses.length;
    this.mejorConfianza = poses.reduce(
      (mejor, pose) => Math.max(mejor, pose.score ?? 0),
      0
    );

    if (!contar) return this.frame;

    this._frames += 1;
    if (ahora - this._ventana >= 500) {
      const transcurrido = ahora - this._ventana;
      this.fps = transcurrido > 0 ? Math.round((this._frames * 1000) / transcurrido) : 0;
      this._frames = 0;
      this._ventana = ahora;
    }

    return this.frame;
  }

  /**
   * Camino común: un frame ya validado (real o de prueba).
   * @param {object} frame frame del contrato de tracking
   * @param {number} ahora
   * @param {object|null} resultado salida del ParticipantTracker (opcional)
   */
  ingestFrame(frame, ahora = this.reloj(), resultado = null) {
    this.frame = frame;
    this.ultimoIngest = ahora;

    if (resultado) {
      this.session = resultado.session;
      this.participantes = resultado.participants.length;
    } else {
      const presentes = (frame?.persons ?? []).filter((persona) => persona.present);
      this.participantes = presentes.length;
      this.session =
        presentes.length === 0
          ? "SELECTING"
          : presentes.length === 1
            ? "PARTIAL"
            : "LOCKED";
    }

    return this.frame;
  }

  // ------------------------------------------------------------
  // Un cuadro
  // ------------------------------------------------------------

  /** @param {number} dt segundos */
  update(dt) {
    const ahora = this.reloj();

    // Si el modelo dejó de avisar, se avanza el tracking con "nadie":
    // las personas pasan a LOST y los organismos empiezan a irse.
    if (this.tracker && ahora - this.ultimoIngest > SIN_SENAL_MS) {
      this.ingestPoses([], ahora, false);
    }

    const resultado = this.manager.update(dt, this.frame);

    this.candidatos = this.tracker?.candidates?.length ?? 0;

    const personas = this.frame?.persons ?? [];
    this.energia = personas.reduce((maximo, persona) => Math.max(maximo, persona.energy ?? 0), 0);
    this.anclas = personas.reduce(
      (maximo, persona) => Math.max(maximo, (persona.anchors ?? []).filter(Boolean).length),
      0
    );

    this.registrarEventos(resultado.eventos);
    this.actualizarPoses(resultado.organismos, dt);

    const distancia = this.distanciaEntrePersonas();
    this.behaviors.update({ distancia });

    this.items = resultado.organismos.map((item) => {
      const registro = this.poses.get(item.organismo.id);
      const comportamiento = this.behaviors.estadoDe(item.organismo.id);

      return {
        ...item,
        pose: registro.pose.estado,
        vinculos: registro.vinculos,
        emocion: comportamiento.emocion,
        comportamiento: comportamiento.comportamiento,
        progreso: comportamiento.progreso,
        parejaId: comportamiento.parejaId,
      };
    });

    return this.items;
  }

  /** Altas y bajas de organismos en el motor de comportamientos. */
  registrarEventos(eventos) {
    for (const evento of eventos) {
      if (evento.tipo === "nacio") this.behaviors.registrar(evento.organismoId);
      if (evento.tipo === "desaparecio") this.behaviors.darDeBaja(evento.organismoId);

      this.eventos.push(evento);
    }

    if (this.eventos.length > MAX_EVENTOS) {
      this.eventos = this.eventos.slice(-MAX_EVENTOS);
    }
  }

  /** Crea, avanza y olvida la pose viva de cada organismo. */
  actualizarPoses(organismos, dt) {
    const personasPorId = new Map(
      (this.frame?.persons ?? []).map((persona) => [persona.id, persona])
    );

    for (const item of organismos) {
      if (!this.poses.has(item.organismo.id)) {
        const vinculos = crearVinculos(item.organismo.shape, item.organismo.seed);
        this.poses.set(item.organismo.id, {
          vinculos,
          pose: new OrganismPose(item.organismo.shape, vinculos),
        });
      }

      const registro = this.poses.get(item.organismo.id);
      registro.pose.update(dt, personasPorId.get(item.personaId) ?? null);
    }

    const activos = new Set(organismos.map((item) => item.organismo.id));
    for (const id of [...this.poses.keys()]) {
      if (!activos.has(id)) this.poses.delete(id);
    }
  }

  /** Distancia normalizada entre las dos personas, si están las dos. */
  distanciaEntrePersonas() {
    const personas = (this.frame?.persons ?? []).filter((persona) => persona.present);
    if (personas.length < 2) return null;

    return Math.hypot(
      personas[0].center.x - personas[1].center.x,
      personas[0].center.y - personas[1].center.y
    );
  }

  // ------------------------------------------------------------
  // Salida
  // ------------------------------------------------------------

  render() {
    if (!this.view) return;

    this.view.draw({
      items: this.items,
      frame: this.frame,
      camara: this.camara,
      session: this.session,
      participantes: this.participantes,
      fps: this.fps,
      mensaje: this.mensaje,
      error: this.error,
      diagnostico: {
        detecciones: this.detecciones,
        mejorConfianza: this.mejorConfianza,
        candidatos: this.candidatos,
        energia: this.energia,
        anclas: this.anclas,
      },
    });
  }

  /**
   * Mensaje para el HUD ("cargando modelo…", errores de cámara).
   * @param {string|null} mensaje
   * @param {boolean} error true solo cuando ya no se puede continuar
   */
  estado(mensaje, error = false) {
    this.mensaje = mensaje;
    this.error = Boolean(error) && Boolean(mensaje);
    return this;
  }
}
