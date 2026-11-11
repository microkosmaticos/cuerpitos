// ============================================================
// deepFreeze.js
//
// Congela un objeto y TODO lo que tiene adentro (arrays y objetos).
// Lo usamos en las familias: una vez creadas no se pueden modificar.
// Es la regla de agent.md: la anatomía no cambia después de nacer.
// ============================================================

export function congelarProfundo(valor) {
  // Los valores simples (números, textos, null) no se congelan.
  if (valor === null || typeof valor !== "object") return valor;

  // Si ya está congelado no hace falta recorrerlo otra vez.
  if (Object.isFrozen(valor)) return valor;

  for (const clave of Object.keys(valor)) {
    congelarProfundo(valor[clave]);
  }

  return Object.freeze(valor);
}
