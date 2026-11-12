// ============================================================
// ciclo.js
//
// CONFIGURACIÓN DEL CICLO DE VIDA. Todo en segundos.
// Congelada: los tiempos no cambian en tiempo de ejecución.
//
// Se puede ajustar acá sin tocar la lógica del gestor.
// ============================================================

import { congelarProfundo } from "../model/families/deepFreeze.js";

export const CICLO = congelarProfundo({
  // Tiempo que la persona tiene que ser válida de forma continua
  // antes de que nazca el organismo. Filtra a quien pasa de largo.
  confirmacion: 0.6,

  // Si la señal se pierde menos que esto, el organismo sigue vivo.
  // Tapa los cortes típicos del tracker y las inferencias lentas
  // (en máquinas sin GPU puede pasar más de un segundo entre poses).
  gracia: 2,

  // Duración de la transición de nacimiento.
  nacimiento: 1.5,

  // Duración de la transición de desaparición.
  desaparicion: 2,

  // Intentos para que dos organismos simultáneos no compartan paleta.
  intentosDePaleta: 20,

  // Umbrales de "persona válida".
  presencia: congelarProfundo({
    // MoveNet devuelve confianzas más bajas que las que suponía el
    // prototipo: un torso de frente promedia 0.45-0.65. Con 0.6 muchos
    // cuerpos válidos nunca llegaban a nacer.
    confianzaMinima: 0.45,
    confianzaHombro: 0.35,
    margenX: { min: 0.15, max: 0.85 },
    margenY: { min: 0.1, max: 0.9 },
    // Separación mínima entre hombros (normalizada).
    separacionHombros: 0.08,
  }),

  // Cuántos organismos pueden existir a la vez.
  maximoDeOrganismos: 2,
});
