#!/usr/bin/env node
// ============================================================
// tests/verificar-genomas.mjs
//
// Pruebas del genoma aleatorio y del organismo.
// Sin dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-genomas.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló.
//
// Qué comprueba:
//   - Misma semilla → exactamente el mismo organismo.
//   - 1000 semillas por familia: valores dentro de los rangos,
//     cantidades dentro de roles.min/max, ángulos dentro del
//     angleRange, padres antes que hijos, separación entre hermanos
//     y cadena no creciente.
//   - El genoma y el organismo están congelados.
//   - La canónica de cada familia respeta los rangos.
//   - 100 semillas distintas producen organismos distintos.
// ============================================================

import { FamilyRegistry } from "../src/model/FamilyRegistry.js";
import { createGenome, SEPARACION_GARANTIZADA } from "../src/model/genome/createGenome.js";
import { bornOrganism } from "../src/model/genome/bornOrganism.js";
import { construirCanonica } from "../src/model/families/canonical.js";

// ------------------------------------------------------------
// Mini framework
// ------------------------------------------------------------

const reportes = [];

function crearReporte(nombre) {
  const reporte = { nombre, comprobaciones: 0, errores: [] };
  reportes.push(reporte);
  return reporte;
}

function comprobarEn(reporte) {
  return (condicion, mensaje) => {
    reporte.comprobaciones++;
    if (!condicion) reporte.errores.push(mensaje);
  };
}

const familias = FamilyRegistry.listFamilies();
const SEMILLAS = 1000;

// ------------------------------------------------------------
// Validación de un genoma
// ------------------------------------------------------------

/**
 * Devuelve la lista de problemas de un genoma.
 * Se usa tanto en el recorrido masivo como en las pruebas puntuales.
 */
function problemasDelGenoma(familia, genome) {
  const problemas = [];

  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((c) => [c.child, c]));

  // 1. Cada parte existe, tiene sus medidas en rango y su ángulo permitido
  for (const parte of genome.parts) {
    const slot = slotsPorId.get(parte.slotId);
    if (!slot) {
      problemas.push(`slot desconocido: ${parte.slotId}`);
      continue;
    }

    for (const [medida, rango] of Object.entries(slot.ranges)) {
      const valor = parte[medida];
      if (typeof valor !== "number") {
        problemas.push(`${parte.slotId} no tiene ${medida}`);
        continue;
      }
      if (valor < rango.min || valor > rango.max) {
        problemas.push(`${parte.slotId} ${medida}=${valor.toFixed(1)} fuera de ${rango.min}–${rango.max}`);
      }
    }

    const conexion = conexionPorHijo.get(parte.slotId);
    if (conexion) {
      if (typeof parte.angle !== "number") {
        problemas.push(`${parte.slotId} no tiene ángulo`);
      } else if (
        parte.angle < conexion.angleRange.min ||
        parte.angle > conexion.angleRange.max
      ) {
        problemas.push(
          `${parte.slotId} angle=${parte.angle.toFixed(1)} fuera de ${conexion.angleRange.min}–${conexion.angleRange.max}`
        );
      }
    }
  }

  // 2. Cantidad de partes por rol
  for (const [rol, rango] of Object.entries(familia.roles)) {
    const cantidad = genome.parts.filter(
      (parte) => slotsPorId.get(parte.slotId)?.role === rol
    ).length;

    if (cantidad < rango.min || cantidad > rango.max) {
      problemas.push(`rol ${rol}: ${cantidad} partes, fuera de ${rango.min}–${rango.max}`);
    }
  }

  // 3. Cada padre aparece antes que su hijo
  const posiciones = new Map(genome.parts.map((parte, indice) => [parte.slotId, indice]));
  for (const parte of genome.parts) {
    const conexion = conexionPorHijo.get(parte.slotId);
    if (!conexion) continue;

    const posicionPadre = posiciones.get(conexion.parent);
    if (posicionPadre === undefined) {
      problemas.push(`${parte.slotId} sin padre ${conexion.parent}`);
    } else if (posicionPadre >= posiciones.get(parte.slotId)) {
      problemas.push(`${parte.slotId} aparece antes que su padre ${conexion.parent}`);
    }
  }

  // 4. Separación entre hermanos
  const hermanosPorPadre = new Map();
  for (const parte of genome.parts) {
    const conexion = conexionPorHijo.get(parte.slotId);
    if (!conexion) continue;
    // La cabeza va rígida con el torso: no entra en la separación.
    if (slotsPorId.get(parte.slotId)?.role === "cabeza") continue;
    if (!hermanosPorPadre.has(conexion.parent)) hermanosPorPadre.set(conexion.parent, []);
    hermanosPorPadre.get(conexion.parent).push(parte);
  }

  for (const [padre, hermanos] of hermanosPorPadre) {
    if (hermanos.length < 2) continue;

    for (let i = 0; i < hermanos.length; i++) {
      for (let j = i + 1; j < hermanos.length; j++) {
        const diferencia = Math.abs(hermanos[i].angle - hermanos[j].angle) % 360;
        const distancia = Math.min(diferencia, 360 - diferencia);

        if (distancia < SEPARACION_GARANTIZADA - 0.5) {
          problemas.push(
            `${padre}: ${hermanos[i].slotId} y ${hermanos[j].slotId} a ${distancia.toFixed(1)}° (mínimo ${SEPARACION_GARANTIZADA}°)`
          );
        }
      }
    }
  }

  // 5. Cadena: una parte no puede ser más grande que su padre
  for (const parte of genome.parts) {
    const conexion = conexionPorHijo.get(parte.slotId);
    if (!conexion) continue;

    const slotPadre = slotsPorId.get(conexion.parent);
    if (!slotPadre || slotPadre.role === "nucleo") continue;

    const padre = genome.parts.find((otra) => otra.slotId === conexion.parent);
    if (!padre) continue;

    for (const medida of ["radius", "width"]) {
      if (typeof parte[medida] !== "number" || typeof padre[medida] !== "number") continue;

      // El hijo no puede superar al padre, salvo que su propio mínimo
      // ya sea más grande que el padre.
      const minimo = slotsPorId.get(parte.slotId).ranges[medida]?.min ?? 0;
      const limite = Math.max(padre[medida], minimo);

      if (parte[medida] > limite + 0.001) {
        problemas.push(
          `${parte.slotId} ${medida}=${parte[medida].toFixed(1)} es mayor que su padre ${conexion.parent} (${padre[medida].toFixed(1)})`
        );
      }
    }
  }

  return problemas;
}

/** Guarda como máximo 3 problemas por prueba. */
function recortar(lista) {
  return lista.slice(0, 3);
}

// ------------------------------------------------------------
// 1. Misma semilla, mismo organismo
// ------------------------------------------------------------

for (const familia of familias) {
  const reporte = crearReporte(`${familia.name} — misma semilla`);
  const comprobar = comprobarEn(reporte);

  const a = createGenome(familia, 4242);
  const b = createGenome(familia, 4242);

  comprobar(
    JSON.stringify(a) === JSON.stringify(b),
    `${familia.name}: el genoma cambia entre dos creaciones con la misma semilla`
  );

  const c = createGenome(familia, 4243);
  comprobar(
    JSON.stringify(a.parts) !== JSON.stringify(c.parts),
    `${familia.name}: semillas distintas dieron el mismo genoma`
  );
}

// bornOrganism elige familia con la semilla: debe ser estable.
{
  const reporte = crearReporte("bornOrganism — misma semilla");
  const comprobar = comprobarEn(reporte);

  for (const semilla of [1, 7, 123, 999]) {
    const uno = bornOrganism(semilla);
    const dos = bornOrganism(semilla);

    comprobar(uno.familyId === dos.familyId, `semilla ${semilla}: distinta familia`);
    comprobar(uno.id === dos.id, `semilla ${semilla}: distinto id`);
    comprobar(
      JSON.stringify(uno.genome.parts) === JSON.stringify(dos.genome.parts),
      `semilla ${semilla}: distinto genoma`
    );
    comprobar(
      JSON.stringify(uno.shape.parts) === JSON.stringify(dos.shape.parts),
      `semilla ${semilla}: distintos puntos`
    );
  }
}

// ------------------------------------------------------------
// 2. 1000 semillas por familia
// ------------------------------------------------------------

for (const familia of familias) {
  const reporte = crearReporte(`${familia.name} — ${SEMILLAS} semillas`);
  const comprobar = comprobarEn(reporte);

  const problemas = [];

  for (let semilla = 0; semilla < SEMILLAS; semilla++) {
    const genome = createGenome(familia, semilla);

    if (!Object.isFrozen(genome)) problemas.push(`semilla ${semilla}: genoma no congelado`);

    for (const problema of problemasDelGenoma(familia, genome)) {
      problemas.push(`semilla ${semilla}: ${problema}`);
    }
  }

  comprobar(
    problemas.length === 0,
    `${problemas.length} problemas en ${SEMILLAS} semillas -> ${recortar(problemas).join(" | ")}`
  );
}

// ------------------------------------------------------------
// 3. Congelado y mutación sin efecto
// ------------------------------------------------------------

{
  const reporte = crearReporte("Genoma y organismo congelados");
  const comprobar = comprobarEn(reporte);

  const organismo = bornOrganism(555);

  comprobar(Object.isFrozen(organismo), "el organismo no está congelado");
  comprobar(Object.isFrozen(organismo.genome), "el genoma no está congelado");
  comprobar(Object.isFrozen(organismo.genome.parts), "las partes del genoma no están congeladas");
  comprobar(Object.isFrozen(organismo.shape), "la forma no está congelada");

  const semillaOriginal = organismo.seed;
  const partesOriginales = organismo.genome.parts.length;

  try {
    organismo.seed = 0;
    organismo.genome.parts.push({ slotId: "inventado" });
    organismo.genome.parts[0].width = 1;
    organismo.genome.parts[0].radius = 1;
  } catch {
    /* en modo estricto tira error: también está bien */
  }

  comprobar(organismo.seed === semillaOriginal, "se pudo cambiar la semilla del organismo");
  comprobar(
    organismo.genome.parts.length === partesOriginales,
    "se pudo agregar una parte al genoma"
  );
}

// ------------------------------------------------------------
// 4. Canónicas dentro de rango
// ------------------------------------------------------------

for (const familia of familias) {
  const reporte = crearReporte(`${familia.name} — canónica`);
  const comprobar = comprobarEn(reporte);

  const problemas = problemasDelGenoma(familia, { parts: familia.canonical.parts });

  comprobar(
    problemas.length === 0,
    `${familia.name}: la canónica tiene problemas -> ${recortar(problemas).join(" | ")}`
  );

  const forma = construirCanonica(familia);
  comprobar(forma.parts.length > 0, `${familia.name}: la canónica no construyó ninguna parte`);
  comprobar(
    forma.parts.every((parte) => parte.points.length >= 3),
    `${familia.name}: alguna parte tiene menos de 3 puntos`
  );
}

// ------------------------------------------------------------
// 5. Variedad
// ------------------------------------------------------------

for (const familia of familias) {
  const reporte = crearReporte(`${familia.name} — variedad`);
  const comprobar = comprobarEn(reporte);

  const genomas = Array.from({ length: 100 }, (_, semilla) =>
    JSON.stringify(createGenome(familia, semilla).parts)
  );

  comprobar(
    new Set(genomas).size === 100,
    `${familia.name}: de 100 semillas solo salieron ${new Set(genomas).size} genomas distintos`
  );
}

// ------------------------------------------------------------
// Salida
// ------------------------------------------------------------

let totalComprobaciones = 0;
let totalErrores = 0;

for (const reporte of reportes) {
  totalComprobaciones += reporte.comprobaciones;
  totalErrores += reporte.errores.length;

  const estado = reporte.errores.length === 0 ? "OK   " : "FALLÓ";
  console.log(`${estado}  ${reporte.nombre} — ${reporte.comprobaciones} comprobaciones`);

  for (const error of reporte.errores) {
    console.log(`        ✗ ${error}`);
  }
}

console.log("");
if (totalErrores === 0) {
  console.log(`TODO OK — ${familias.length} familias · ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
