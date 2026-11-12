// ============================================================
// efectos.js
//
// TRADUCCIÓN de emociones y comportamientos a efectos visuales.
//
// Es una función PURA: recibe el estado que ya calculó el motor de
// comportamientos y devuelve números que la vista aplica. Así el
// motor no sabe dibujar, la vista no sabe de reglas, y esto se puede
// probar sin navegador.
//
//   emocion       id de EMOTIONS ('shy', 'euphoric', ...)
//   comportamiento id de EVENTS ('approach', 'hug', ...) o null
//   progreso      0..1 del comportamiento activo
//   tiempo        segundos, para las oscilaciones
//
// Los desplazamientos (acercar, alejar, salto, temblor) son 0..1:
// la vista los multiplica por el tamaño del organismo.
// ============================================================

/** Forma de campana: 0 al empezar, 1 en el medio, 0 al terminar. */
export function campana(progreso) {
  const t = Math.min(1, Math.max(0, progreso));
  return Math.sin(Math.PI * t);
}

const BASE = Object.freeze({
  escala: 1,
  rotacion: 0,
  acercar: 0,
  alejar: 0,
  salto: 0,
  temblor: 0,
  halo: 1,
  extremidad: 0,
});

/** Emociones: efecto continuo mientras dura el estado. */
const POR_EMOCION = Object.freeze({
  neutral: {},

  shy: {
    escala: 0.86,
    rotacion: -0.12,
    temblor: 0.18,
    halo: 0.5,
  },

  attracted: {
    acercar: 0.3,
    escala: 1.03,
    halo: 1.2,
  },

  lovestruck: {
    acercar: 0.18,
    halo: 1.45,
  },

  euphoric: {
    escala: 1.08,
    salto: 0.3,
    halo: 1.4,
  },

  nauseous: {
    rotacion: 0.18,
    temblor: 0.45,
    halo: 0.7,
  },

  fainted: {
    escala: 0.8,
    rotacion: 0.12,
    temblor: 0.04,
    halo: 0.15,
  },
});

/** Comportamientos: efecto que crece y se apaga con el progreso. */
const POR_COMPORTAMIENTO = Object.freeze({
  approach: { acercar: 0.7 },
  hug: { acercar: 0.6, escala: 1.05, halo: 1.3 },
  kiss: { acercar: 0.68, escala: 1.04, halo: 1.45 },
  punch: { alejar: 0.5, temblor: 1.2, rotacion: 0.25 },
  reject: { alejar: 0.6, rotacion: 0.15, halo: 0.6 },
  euphoric_burst: { salto: 0.55, escala: 1.12, halo: 1.5 },
  faint: { escala: 0.72, salto: -0.4, halo: 0.15 },
  shake: { temblor: 1.1, rotacion: 0.2 },
  limb_stretch: { extremidad: 1.3, escala: 1.05 },
});

/**
 * Efecto combinado emoción + comportamiento.
 * @returns {{escala:number, rotacion:number, acercar:number, alejar:number,
 *            salto:number, temblor:number, halo:number, extremidad:number}}
 */
export function calcularEfecto({
  emocion = "neutral",
  comportamiento = null,
  progreso = 0,
  tiempo = 0,
} = {}) {
  const efecto = { ...BASE };

  const emocionEfecto = POR_EMOCION[emocion] ?? {};
  mezclar(efecto, emocionEfecto, 1);

  if (comportamiento) {
    const comportamientoEfecto = POR_COMPORTAMIENTO[comportamiento] ?? {};
    mezclar(efecto, comportamientoEfecto, campana(progreso));
  }

  // Oscilación lenta del mareo / temblor. La vista usa `temblor` para
  // la vibración rápida; acá solo se inclina el cuerpo.
  efecto.rotacion += Math.sin(tiempo * 3) * 0.06 * efecto.temblor;

  return efecto;
}

/** Mezcla proporcional (0..1) de los campos del efecto parcial. */
function mezclar(destino, parcial, peso) {
  for (const [clave, valor] of Object.entries(parcial)) {
    destino[clave] += valor * peso;
  }
}
