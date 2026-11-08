// ============================================================
// EscenarioController.js
//
// El CONTROLADOR del escenario. Conecta:
//   fuente (MockTracker)  →  pose (OrganismPose)  →  vista
//
// No calcula movimiento ni dibuja: solo pide el frame, lo entrega
// al organismo que le corresponde y le pasa la pose a la vista.
// ============================================================

export class EscenarioController {
  /**
   * @param {object} datos
   * @param {object} datos.organismo organismo nacido
   * @param {object} datos.pose OrganismPose
   * @param {object} datos.vinculos vínculos parte ↔ ancla
   * @param {object} datos.tracker fuente de frames
   * @param {object} datos.view vista del escenario
   */
  constructor({ organismo, pose, vinculos, tracker, view }) {
    this.organismo = organismo;
    this.pose = pose;
    this.vinculos = vinculos;
    this.tracker = tracker;
    this.view = view;
    this.frame = null;
  }

  /** Avanza un fotograma. */
  update(dt) {
    this.frame = this.tracker.update(dt);

    // Por ahora el organismo escucha a la primera persona.
    // Con dos personas (paso siguiente) se empareja por id.
    const persona = this.frame.persons[0] ?? null;
    this.pose.update(dt, persona);
  }

  render() {
    this.view.draw({
      organismo: this.organismo,
      pose: this.pose.estado,
      frame: this.frame ?? { persons: [] },
      vinculos: this.vinculos,
      modo: this.tracker.modo,
    });
  }
}
