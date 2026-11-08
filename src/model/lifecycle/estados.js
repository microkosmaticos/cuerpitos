// ============================================================
// estados.js
//
// LOS CUATRO ESTADOS de un organismo y su orden.
//
// Máquina de estados: cada organismo está en UN estado y solo
// cambia cuando ocurre un evento definido:
//
//   (sin organismo)
//        │  persona válida durante "confirmación"
//        ▼
//   naciendo ──(presencia llega a 1)──► vivo
//                                       │
//                                      (sin señal más de "gracia")
//                                       ▼
//                                desvaneciendo
//                                       │
//                                 (presencia llega a 0)
//                                       ▼
//                                 desaparecido (se elimina)
// ============================================================

import { congelarProfundo } from "../families/deepFreeze.js";

export const ESTADOS = congelarProfundo({
  NACIENDO: "naciendo",
  VIVO: "vivo",
  DESVANECIENDO: "desvaneciendo",
  DESAPARECIDO: "desaparecido",
});

/** Orden natural del ciclo. Útil para pruebas y depuración. */
export const ORDEN_DE_ESTADOS = congelarProfundo([
  ESTADOS.NACIENDO,
  ESTADOS.VIVO,
  ESTADOS.DESVANECIENDO,
  ESTADOS.DESAPARECIDO,
]);
