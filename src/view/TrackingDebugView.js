// ============================================================
// TrackingDebugView.js
//
// Dibuja la DEPURACIÓN del tracking: los anchors de cada persona,
// una línea desde cada parte hasta el ancla que sigue, y los valores
// de energía y confianza.
//
// Acepta varias personas y varios organismos: cada organismo dibuja
// sus líneas con su propia transformación a pantalla.
//
// Es solo dibujo: recibe los datos ya calculados.
// ============================================================

export function dibujarDepuracion(p, { frame, items, partesPorOrganismo, pantallas }) {
  const personas = frame?.persons ?? [];

  // 1. Anchors de todas las personas.
  for (const persona of personas) {
    persona.anchors.forEach((ancla, indice) => {
      if (!ancla) return;

      const x = ancla.x * p.width;
      const y = ancla.y * p.height;

      p.noStroke();
      p.fill(0, 255, 200, 220);
      p.circle(x, y, 10);

      p.fill(0, 255, 200, 160);
      p.textSize(9);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text(String(indice), x + 7, y - 4);
    });
  }

  // 2. Líneas desde el origen de cada parte hasta su ancla.
  for (const item of items) {
    const persona = personas.find((candidata) => candidata.id === item.personaId);
    if (!persona) continue;

    const partes = partesPorOrganismo.get(item.organismo.id) ?? [];
    const aPantalla = pantallas.get(item.organismo.id);
    if (!aPantalla) continue;

    const partesPorId = new Map(partes.map((parte) => [parte.id, parte]));

    for (const vinculo of item.vinculos.vinculos) {
      const parte = partesPorId.get(vinculo.partId);
      const ancla = persona.anchors[vinculo.ancla];
      if (!parte || !ancla) continue;

      const desde = aPantalla(parte.origenActual ?? parte.origen);
      const hasta = { x: ancla.x * p.width, y: ancla.y * p.height };

      p.stroke(0, 255, 200, 90);
      p.strokeWeight(1);
      p.line(desde.x, desde.y, hasta.x, hasta.y);

      p.noStroke();
      p.fill(0, 255, 200, 150);
      p.textSize(8);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(`${vinculo.partId}→${vinculo.ancla}`, (desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2 - 6);
    }
  }

  // 3. Panel de valores por persona.
  const alto = 16 + personas.length * 42;
  p.noStroke();
  p.fill(0, 0, 0, 140);
  p.rect(p.width - 210, 16, 194, alto, 6);

  p.textAlign(p.LEFT, p.TOP);
  personas.forEach((persona, indice) => {
    const y = 26 + indice * 42;
    p.fill(0, 255, 200, 220);
    p.textSize(11);
    p.text(`${persona.id} · ${persona.present ? "presente" : "ausente"}`, p.width - 198, y);
    p.fill(255, 255, 255, 170);
    p.text(
      `energía ${persona.energy.toFixed(2)} · confianza ${persona.confidence.toFixed(2)}`,
      p.width - 198,
      y + 16
    );
  });
}
