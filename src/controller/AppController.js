// ============================================================
// AppController.js
//
// El CONTROLADOR. Es el intermediario entre los datos y el dibujo.
// Guarda cuál es la forma actual y responde a lo que el usuario
// pide (siguiente / anterior). No dibuja nada por su cuenta:
// le pide a la vista que lo haga.
// ============================================================

export class AppController {
  /**
   * @param {import("../model/ShapeDefinition.js").ShapeDefinition[]} shapes
   * @param {import("../view/OrganismView.js").OrganismView} view
   */
  constructor(shapes, view) {
    this.shapes = shapes;
    this.view = view;
    this.index = 0;
  }

  /** La forma que se está mostrando ahora. */
  current() {
    return this.shapes[this.index];
  }

  /** Pasa a la forma siguiente (vuelve al principio al final). */
  next() {
    this.index = (this.index + 1) % this.shapes.length;
  }

  /** Vuelve a la forma anterior. */
  previous() {
    this.index = (this.index - 1 + this.shapes.length) % this.shapes.length;
  }

  /** Pinta el estado actual. Se llama una vez por frame. */
  render() {
    const shape = this.current();
    this.view.draw(shape);
    this.view.drawHud(shape);
  }
}
