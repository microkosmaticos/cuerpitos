// ============================================================
// TrackingDebugView.js
//
// Dibuja la DEPURACIÓN del tracking: los 7 anchors como círculos,
// una línea desde cada parte hasta el ancla que sigue, y los valores
// de energía y confianza.
//
// Es solo dibujo: recibe los datos ya calculados.
// ============================================================

import { ORDEN_DE_ANCLAS } from "../model/tracking/TrackingFrame.js";

export function dibujarDepuracion(p, { frame, persona, partes, vinculos, aPantalla }) {
  if (!persona) return;

  const ancho = p.width;
  const alto = p.height;

  // 1. Los anchors, en coordenadas de pantalla.
  persona.anchors.forEach((ancla, indice) => {
    if (!ancla) return;

    const x = ancla.x * ancho;
    const y = ancla.y * alto;

    p.noStroke();
    p.fill(0, 255, 200, 220);
    p.circle(x, y, 10);

    p.fill(0, 255, 200, 160);
    p.textSize(9);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(String(indice), x + 7, y - 4);
  });

  // 2. Líneas desde el origen ACTUAL de cada parte hasta su ancla.
  const partesPorId = new Map(partes.map((parte) => [parte.id, parte]));

  for (const vinculo of vinculos.vinculos) {
    const parte = partesPorId.get(vinculo.partId);
    const ancla = persona.anchors[vinculo.ancla];
    if (!parte || !ancla) continue;

    const desde = aPantalla(parte.origenActual ?? parte.origen);

    p.stroke(0, 255, 200, 90);
    p.strokeWeight(1);
    p.line(desde.x, desde.y, ancla.x * ancho, ancla.y * alto);

    p.noStroke();
    p.fill(0, 255, 200, 150);
    p.textSize(8);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(`${vinculo.partId}→${vinculo.ancla}`, (desde.x + ancla.x * ancho) / 2, (desde.y + ancla.y * alto) / 2 - 6);
  }

  // 3. Panel de valores.
  p.noStroke();
  p.fill(0, 0, 0, 140);
  p.rect(ancho - 210, 16, 194, 82, 6);

  p.fill(0, 255, 200, 220);
  p.textSize(11);
  p.textAlign(p.LEFT, p.TOP);
  p.text(`anchors: ${ORDEN_DE_ANCLAS.length}`, ancho - 198, 26);
  p.text(`energía: ${persona.energy.toFixed(2)}`, ancho - 198, 42);
  p.text(`confianza: ${persona.confidence.toFixed(2)}`, ancho - 198, 58);
  p.text(`presente: ${persona.present ? "sí" : "no"}`, ancho - 198, 74);
}
