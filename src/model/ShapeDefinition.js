// ============================================================
// ShapeDefinition.js
//
// Una forma ya lista para dibujar. Es un objeto "de datos puros":
// no sabe nada de p5, de la cámara ni de la pantalla.
//
// Guarda:
//   - id / name / source: identidad y de dónde salió
//   - viewBox: el sistema de coordenadas original del SVG
//   - parts: las partes del cuerpo (cabeza, brazo, torso...)
//   - bounds: la caja que ocupa la forma completa
//
// Cada parte tiene "sides" con puntos:
//   { lado: "left" | "right" | "center", color, points: [{x, y}, ...] }
//
// Tener los puntos separados por lado es lo que después permite
// mover un brazo sin mover el otro, y deformar cada parte aparte.
// ============================================================

/**
 * Caja envolvente de todas las partes visibles.
 * Si una forma no tuviera puntos, se usa el viewBox como respaldo.
 */
function calcularBounds(parts, viewBox) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const part of parts) {
    if (!part.visible) continue;
    for (const side of part.sides) {
      for (const punto of side.points) {
        if (punto.x < minX) minX = punto.x;
        if (punto.y < minY) minY = punto.y;
        if (punto.x > maxX) maxX = punto.x;
        if (punto.y > maxY) maxY = punto.y;
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export class ShapeDefinition {
  /**
   * @param {{ id: string, name: string, source: string, viewBox: object, parts: object[] }} datos
   */
  constructor({ id, name, source, viewBox, parts }) {
    this.id = id;
    this.name = name;
    this.source = source;
    this.viewBox = viewBox;
    this.parts = parts;
    this.bounds = calcularBounds(parts, viewBox);
  }

  /** Partes que se dibujan. */
  visibleParts() {
    return this.parts.filter((part) => part.visible);
  }

  /** Busca una parte por nombre. Devuelve undefined si no existe. */
  getPart(name) {
    return this.parts.find((part) => part.name === name);
  }

  /** Puntos de un lado concreto, por ejemplo getSide("brazo", "left"). */
  getSide(name, sideName) {
    const part = this.getPart(name);
    if (!part) return undefined;
    return part.sides.find((side) => side.side === sideName);
  }
}
