// ============================================================
// EscenarioController.js
//
// El CONTROLADOR del escenario. Conecta:
//   fuente (MockTracker) → ciclo (OrganismManager) → pose → vista
//
// Mantiene una pose por organismo (se crea al nacer y se descarta al
// desaparecer). No decide estados ni tiempos: eso es del modelo.
// ============================================================

import { crearVinculos } from "../model/tracking/crearVinculos.js";
import { OrganismPose } from "../model/tracking/OrganismPose.js";

export class EscenarioController {
  /**
   * @param {object} datos
   * @param {object} datos.manager OrganismManager
   * @param {object} datos.tracker fuente de frames
   * @param {object} datos.view vista del escenario
   */
  constructor({ manager, tracker, view }) {
    this.manager = manager;
    this.tracker = tracker;
    this.view = view;

    this.poses = new Map();
    this.items = [];
    this.ultimoFrame = null;
    this.pendientes = [];
    this.eventos = [];
  }

  update(dt) {
    const frame = this.tracker.update(dt);
    const resultado = this.manager.update(dt, frame);

    const personasPorId = new Map(frame.persons.map((persona) => [persona.id, persona]));

    // Crear y avanzar la pose de cada organismo activo.
    for (const item of resultado.organismos) {
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

    // Olvidar los que ya desaparecieron.
    const activos = new Set(resultado.organismos.map((item) => item.organismo.id));
    for (const id of [...this.poses.keys()]) {
      if (!activos.has(id)) this.poses.delete(id);
    }

    this.items = resultado.organismos.map((item) => {
      const registro = this.poses.get(item.organismo.id);
      return {
        ...item,
        pose: registro.pose.estado,
        vinculos: registro.vinculos,
      };
    });

    this.ultimoFrame = frame;
    this.pendientes = resultado.pendientes;
    this.eventos = [...this.eventos, ...resultado.eventos].slice(-30);
  }

  render() {
    this.view.draw({
      items: this.items,
      frame: this.ultimoFrame,
      modo: this.tracker.modo,
      pendientes: this.pendientes,
      eventos: this.eventos,
    });
  }
}
