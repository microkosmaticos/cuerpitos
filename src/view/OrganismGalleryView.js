// ============================================================
// OrganismGalleryView.js
//
// La VISTA de los organismos. Recibe organismos ya construidos y los
// dibuja, uno solo o seis en grilla. No decide nada: no genera, no
// sortea, no conoce la familia.
//
// Los colores son provisorios y neutros: las paletas son otra tarea.
// ============================================================

import { calcularAjuste } from "./canvasFit.js";

const COLOR_NUCLEO = [232, 232, 242];
const COLOR_PARTE = [196, 196, 214];
const COLOR_OJOS = [26, 26, 34];

export class OrganismGalleryView {
  constructor(p) {
    this.p = p;
  }

  /**
   * @param {object[]} organismos en modo "uno" se usa el primero
   * @param {"uno"|"seis"} modo
   */
  draw(organismos, modo) {
    const p = this.p;

    if (modo === "seis") {
      this.dibujarGrilla(organismos);
    } else {
      const organismo = organismos[0];
      this.dibujarForma(organismo.shape, 0, 0, p.width, p.height, 110);
      this.dibujarEtiqueta(
        organismo.shape.name,
        organismo.seed,
        24,
        20,
        16
      );
    }

    this.dibujarAyuda(modo);
  }

  // ------------------------------------------------------------
  // Dibujo
  // ------------------------------------------------------------

  dibujarGrilla(organismos) {
    const p = this.p;
    const columnas = 3;
    const filas = 2;
    const ancho = p.width / columnas;
    const alto = p.height / filas;

    organismos.forEach((organismo, indice) => {
      const columna = indice % columnas;
      const fila = Math.floor(indice / columnas);
      const x = columna * ancho;
      const y = fila * alto;

      this.dibujarForma(organismo.shape, x, y, ancho, alto, 34);
      this.dibujarEtiqueta(
        organismo.shape.name,
        organismo.seed,
        x + 12,
        y + 10,
        11
      );
    });
  }

  /** Dibuja una forma dentro de un rectángulo. */
  dibujarForma(forma, x, y, ancho, alto, margen) {
    const p = this.p;
    const ajuste = calcularAjuste(forma.bounds, ancho, alto, margen);

    p.push();
    p.translate(x + ancho / 2, y + alto / 2);
    p.scale(ajuste.escala);
    p.translate(-ajuste.centroX, -ajuste.centroY);

    // Primero extremidades, después cabeza, al final el núcleo.
    const ordenadas = [...forma.parts].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    p.noStroke();

    for (const parte of ordenadas) {
      const color = parte.role === "nucleo" ? COLOR_NUCLEO : COLOR_PARTE;
      p.fill(color[0], color[1], color[2]);
      p.beginShape();
      for (const punto of parte.points) p.vertex(punto.x, punto.y);
      p.endShape(p.CLOSE);

      // Los ojos viajan pegados a la cabeza.
      for (const extra of parte.extras ?? []) {
        p.fill(COLOR_OJOS[0], COLOR_OJOS[1], COLOR_OJOS[2]);
        p.beginShape();
        for (const punto of extra) p.vertex(punto.x, punto.y);
        p.endShape(p.CLOSE);
      }
    }

    p.pop();
  }

  dibujarEtiqueta(nombre, semilla, x, y, tamano) {
    const p = this.p;
    p.noStroke();

    p.fill(255, 255, 255, 220);
    p.textSize(tamano);
    p.textAlign(p.LEFT, p.TOP);
    p.text(nombre, x, y);

    p.fill(255, 255, 255, 120);
    p.textSize(tamano - 3);
    p.text(`semilla ${semilla}`, x, y + tamano + 4);
  }

  dibujarAyuda(modo) {
    const p = this.p;
    p.noStroke();
    p.fill(255, 255, 255, 110);
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);

    const ayuda =
      modo === "seis"
        ? "ESPACIO  otros seis      G  volver a uno"
        : "ESPACIO  nacer otro      G  ver seis";

    p.text(ayuda, 24, p.height - 28);
  }
}

/** 0 = extremidades, 1 = cabeza, 2 = núcleo. */
function pesoDeDibujo(parte) {
  if (parte.role === "nucleo") return 2;
  if (parte.role === "cabeza") return 1;
  return 0;
}
