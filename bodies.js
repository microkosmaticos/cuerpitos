// ============================================================
// bodies.js
//
// LOS AVATARES. Punto de entrada único del modelo de organismos:
// familias de formas, paletas, genoma, ciclo de vida y pose viva.
//
// Este archivo no reimplementa nada: reúne lo que ya vive en
// src/model/** detrás de un solo nombre, para que la experiencia se
// lea como la cadena completa:
//
//   enviroment.js   fondo artístico (base, olas, estrellas)
//        │
//   bodypose.js     reconocimiento de cuerpo (ml5 + MoveNet)
//        │
//   bodies.js       avatares generativos (este archivo)
//        │
//   reaccions.js    emociones, eventos e interacciones
//
// Cómo se conectan:
//   1. `bodypose.js` detecta personas y `participants.js` bloquea
//      hasta dos con un id estable.
//   2. `TrackingAdapter` convierte esas personas al contrato de 7
//      anclas (0..1, sin espejo).
//   3. `OrganismManager` hace nacer un organismo por persona
//      (`bornOrganism`) y lo mantiene hasta que la persona se va.
//   4. `crearVinculos` decide, al nacer, qué ancla mueve cada parte y
//      con qué temperamento.
//   5. `OrganismPose` traduce el movimiento de las anclas a la pose
//      viva del organismo.
//   6. `reaccions.js` decide emociones y eventos; la vista traduce sus
//      directivas a efectos (acercarse, abrazarse, temblar, desmayarse).
//
// La identidad de cada avatar (familia, paleta, semilla) se sortea una
// sola vez al nacer y no cambia durante su vida.
// ============================================================

export { OrganismManager, PASO_FIJO } from "./src/model/lifecycle/OrganismManager.js";
export { ESTADOS, ORDEN_DE_ESTADOS } from "./src/model/lifecycle/estados.js";
export { bornOrganism } from "./src/model/genome/bornOrganism.js";
export { crearVinculos, TEMPERAMENTO } from "./src/model/tracking/crearVinculos.js";
export { OrganismPose, LIMITES } from "./src/model/tracking/OrganismPose.js";
export { CANTIDAD_DE_ANCLAS, MAXIMO_DE_PERSONAS } from "./src/model/tracking/TrackingFrame.js";
