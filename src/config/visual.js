// ============================================================
// visual.js
//
// CONFIGURACIÓN VISUAL COMPARTIDA por las tres páginas:
//   index.html        (formas del Paso A)
//   galeria.html      (canónicas de las familias)
//   organismos.html   (organismos generados)
//
// Cambiando estos dos valores, las tres muestran lo mismo.
// El modelo no se entera: esto es solo qué se dibuja.
// ============================================================

import { congelarProfundo } from "../model/families/deepFreeze.js";

export const VISUAL = congelarProfundo({
  // La cabeza es una excepción a agent.md ("sin rostro ni cuello").
  mostrarCabeza: true,
  // Los ojos van como decoración de la cabeza.
  mostrarOjos: true,
});

/**
 * ¿Esta parte se dibuja?
 * Acepta partes del Paso A (con "name") y partes de organismos (con "role").
 */
export function mostrarParte(parte) {
  if (!parte) return false;

  const nombre = String(parte.role ?? parte.name ?? "").toLowerCase();

  if (nombre === "cabeza") return VISUAL.mostrarCabeza;
  if (nombre === "ojos") return VISUAL.mostrarOjos;

  return parte.visible !== false;
}

/** ¿Se dibujan las decoraciones (los ojos) de una parte? */
export function mostrarExtras() {
  return VISUAL.mostrarOjos;
}
