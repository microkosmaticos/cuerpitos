// ============================================================
// FamilyGalleryView.js
//
// La VISTA de la galería. Recibe una forma canónica ya construida
// (con sus puntos) y la dibuja. No define anatomías, no decide
// cuántas partes hay y no toca la cámara.
//
// Los colores son provisorios y neutros: las paletas son una tarea
// posterior. El contorno oscuro solo sirve para leer la anatomía.
// ============================================================

import { calcularAjuste } from "./canvasFit.js";
import { mostrarExtras, mostrarParte } from "../config/visual.js";

export class FamilyGalleryView {
  /**
   * @param {object} p la instancia de p5
   */
  constructor(p) {
    this.p = p;
  }
  /**
   * @param {object} forma resultado de construirCanonica()
   */
  draw(forma) {
    if (!forma) return;

    const p = this.p;
    const ajuste = calcularAjuste(forma.bounds, p.width, p.height, 90);

    p.push();

    // Mismo truco que en OrganismView: centro del canvas, escala, centro de la forma.
    p.translate(p.width / 2, p.height / 2);
    p.scale(ajuste.escala);
    p.translate(-ajuste.centroX, -ajuste.centroY);

    p.fill(226, 226, 238);
    p.noStroke();

    // Orden de dibujo: primero las extremidades, después la cabeza
    // y al final el núcleo. Así el núcleo tapa las uniones y la cabeza
    // queda por encima de las piezas que la rodean.
    const ordenadas = [...forma.parts].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    for (const parte of ordenadas) {
      if (!mostrarParte(parte)) continue;

      // Dos tonos neutros por ahora: las paletas son otra tarea.
      // El tono más claro es el núcleo y el más oscuro el resto.
      if (parte.role === "nucleo") p.fill(232, 232, 242);
      else p.fill(196, 196, 214);

      p.beginShape();
      for (const punto of parte.points) {
        p.vertex(punto.x, punto.y);
      }
      p.endShape(p.CLOSE);

      // Decoraciones que viajan pegadas a la parte (por ejemplo, los ojos
      // de la cabeza). Van más oscuras para que se distingan.
      if (!mostrarExtras()) continue;
      for (const extra of parte.extras ?? []) {
        p.fill(26, 26, 34);
        p.beginShape();
        for (const punto of extra) {
          p.vertex(punto.x, punto.y);
        }
        p.endShape(p.CLOSE);
      }
    }

    p.pop();
  }

  /** Nombre de la familia y ayuda de teclas. */
  drawHud(forma, indice, total) {
    if (!forma) return;

    const p = this.p;
    p.noStroke();

    p.fill(255, 255, 255, 220);
    p.textSize(16);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`${forma.name}`, 24, 20);

    p.fill(255, 255, 255, 130);
    p.textSize(12);
    p.text(forma.description, 24, 46);
    p.text(
      `familia ${indice + 1} de ${total} · partes: ${forma.parts.length}`,
      24,
      66
    );
    p.text("← / A  anterior      → / D  siguiente", 24, 88);
  }
}

/**
 * Qué tan arriba se dibuja cada parte.
 * 0 = extremidades, 1 = cabeza, 2 = núcleo (el último tapa las uniones).
 */
function pesoDeDibujo(parte) {
  if (parte.role === "nucleo") return 2;
  if (parte.role === "cabeza") return 1;
  return 0;
}
