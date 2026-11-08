// ============================================================
// OrganismView.js
//
// La VISTA. Su único trabajo es dibujar en pantalla.
// No sabe de dónde salen los datos: recibe una ShapeDefinition
// y la pinta. Nunca toca la cámara ni decide qué forma mostrar.
// ============================================================

import { calcularAjuste } from "./canvasFit.js";

export class OrganismView {
  /**
   * @param {object} p la instancia de p5
   */
  constructor(p) {
    this.p = p;
  }

  /**
   * Dibuja una forma centrada y escalada para que entre en pantalla.
   * @param {import("../model/ShapeDefinition.js").ShapeDefinition} shape
   */
  draw(shape) {
    if (!shape) return;

    const p = this.p;
    const bounds = shape.bounds;

    // Escala y centro: los calcula canvasFit para no repetir la cuenta.
    const ajuste = calcularAjuste(bounds, p.width, p.height, 90);

    p.push();

    // 1. Llevamos el centro del canvas al origen.
    p.translate(p.width / 2, p.height / 2);
    // 2. Escalamos.
    p.scale(ajuste.escala);
    // 3. Movemos la forma para que su centro quede en el origen.
    p.translate(-ajuste.centroX, -ajuste.centroY);

    p.noStroke();

    // El orden importa: se dibuja de atrás hacia adelante,
    // igual que en el SVG original (torso al final, arriba de todo).
    for (const part of shape.visibleParts()) {
      for (const side of part.sides) {
        p.fill(side.color);
        p.beginShape();
        for (const punto of side.points) {
          p.vertex(punto.x, punto.y);
        }
        p.endShape(p.CLOSE);
      }
    }

    p.pop();
  }

  /** Texto de ayuda arriba a la izquierda. */
  drawHud(shape) {
    if (!shape) return;

    const p = this.p;
    p.noStroke();

    p.fill(255, 255, 255, 210);
    p.textSize(15);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`${shape.name}`, 24, 20);

    p.fill(255, 255, 255, 120);
    p.textSize(12);
    p.text("← / A  anterior      → / D  siguiente", 24, 44);
  }
}
