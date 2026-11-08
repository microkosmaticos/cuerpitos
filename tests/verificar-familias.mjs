#!/usr/bin/env node
// ============================================================
// tests/verificar-familias.mjs
//
// Verifica las familias anatómicas SIN abrir el navegador.
// No usa dependencias: solo Node.
//
// Cómo correrlo, desde la raíz del proyecto:
//   node tests/verificar-familias.mjs
//
// Termina con código 0 si todo está bien y 1 si algo falló,
// para que también sirva en una integración automática.
//
// Qué comprueba:
//   REGISTRO
//     - hay 4 familias con ids únicos
//     - se encuentran por nombre y por id
//     - el registro está congelado
//   DATOS DE CADA FAMILIA
//     - congelado profundo y mutación sin efecto
//     - slots declarados = máximo del rol, rangos válidos
//     - ids de slot únicos
//     - anclas consecutivas y núcleo sin ancla
//     - una conexión por parte, con padre existente
//   FORMA CANÓNICA
//     - determinista (dos construcciones idénticas)
//     - 1 núcleo, sin NaN, al menos 3 puntos por parte
//     - cada valor dentro de los ranges de su slot
//     - cada ángulo dentro del angleRange de su conexión
//     - cada slotId existe y el padre aparece antes que el hijo
//     - cantidad de partes por rol = valor medio redondeado
// ============================================================

import { FamilyRegistry } from "../src/model/FamilyRegistry.js";
import { construirCanonica } from "../src/model/families/canonical.js";

// ------------------------------------------------------------
// Mini framework: junta los resultados y después imprime
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

/** Recorre un objeto y devuelve las rutas que NO están congeladas. */
function rutasSinCongelar(valor, ruta = "objeto", encontradas = []) {
  if (valor === null || typeof valor !== "object") return encontradas;

  if (!Object.isFrozen(valor)) encontradas.push(ruta);

  for (const [clave, hijo] of Object.entries(valor)) {
    rutasSinCongelar(hijo, `${ruta}.${clave}`, encontradas);
  }

  return encontradas;
}

/** Regla acordada: cantidad de partes = valor medio del rango, redondeado. */
function valorMedioRedondeado(rango) {
  return Math.round((rango.min + rango.max) / 2);
}

// ------------------------------------------------------------
// Registro
// ------------------------------------------------------------

function verificarRegistro() {
  const reporte = crearReporte("Registro de familias");
  const comprobar = comprobarEn(reporte);

  const familias = FamilyRegistry.listFamilies();

  comprobar(familias.length === 4, `se esperaban 4 familias y hay ${familias.length}`);

  const ids = familias.map((familia) => familia.id);
  comprobar(new Set(ids).size === familias.length, "hay ids de familia repetidos");

  for (const familia of familias) {
    comprobar(
      FamilyRegistry.getFamily(familia.name)?.id === familia.id,
      `getFamily no encontró por nombre: "${familia.name}"`
    );
    comprobar(
      FamilyRegistry.getFamily(familia.id)?.id === familia.id,
      `getFamily no encontró por id: "${familia.id}"`
    );
    comprobar(FamilyRegistry.hasFamily(familia.id), `hasFamily false para "${familia.id}"`);
  }

  comprobar(
    FamilyRegistry.getFamily("familia-inventada") === undefined,
    "getFamily debería devolver undefined con un nombre inexistente"
  );

  comprobar(
    rutasSinCongelar(FamilyRegistry, "registro").length === 0,
    "el registro no está congelado en profundidad"
  );

  return reporte;
}

// ------------------------------------------------------------
// Datos de una familia
// ------------------------------------------------------------

function verificarDatos(familia, reporte) {
  const comprobar = comprobarEn(reporte);
  const nombre = familia.name;

  // Congelado profundo
  const descongelados = rutasSinCongelar(familia, "familia");
  comprobar(
    descongelados.length === 0,
    `${nombre}: no está congelado en profundidad -> ${descongelados.join(", ")}`
  );

  // Mutación sin efecto (en modo estricto tirar error también está bien)
  const minimoOriginal = familia.roles.nucleo.min;
  try {
    familia.roles.nucleo.min = 999;
  } catch {
    /* congelado: perfecto */
  }
  comprobar(
    familia.roles.nucleo.min === minimoOriginal,
    `${nombre}: se pudo modificar roles.nucleo.min`
  );

  // Datos básicos
  comprobar(Boolean(familia.id), `${nombre}: falta id`);
  comprobar(Boolean(familia.name), `${nombre}: falta name`);
  comprobar(Boolean(familia.description), `${nombre}: falta description`);
  comprobar(Array.isArray(familia.slots) && familia.slots.length > 0, `${nombre}: no hay slots`);

  // Slots contra roles
  for (const [rol, rango] of Object.entries(familia.roles)) {
    comprobar(rango.min >= 1, `${nombre}: rol "${rol}" tiene mínimo menor a 1`);
    comprobar(rango.max >= rango.min, `${nombre}: rol "${rol}" tiene máximo menor que el mínimo`);

    const declarados = familia.slots.filter((slot) => slot.role === rol).length;
    comprobar(
      declarados === rango.max,
      `${nombre}: rol "${rol}" tiene ${declarados} slots y el máximo es ${rango.max}`
    );
  }

  // Ids de slot únicos
  const idsSlots = familia.slots.map((slot) => slot.id);
  comprobar(new Set(idsSlots).size === idsSlots.length, `${nombre}: hay ids de slot repetidos`);

  // Anclas
  const nucleo = familia.slots.find((slot) => slot.role === "nucleo");
  comprobar(Boolean(nucleo), `${nombre}: falta el núcleo`);
  if (nucleo) {
    comprobar(nucleo.anchor === null, `${nombre}: el núcleo no debe tener ancla`);
  }

  const moviles = familia.slots.filter((slot) => slot.role !== "nucleo");
  const anclas = moviles.map((slot) => slot.anchor);
  const anclasEsperadas = moviles.map((_, indice) => indice);
  comprobar(
    JSON.stringify(anclas) === JSON.stringify(anclasEsperadas),
    `${nombre}: las anclas deberían ser 0, 1, 2... y son ${JSON.stringify(anclas)}`
  );

  // Conexiones
  for (const slot of familia.slots) {
    const conexiones = familia.connections.filter((conexion) => conexion.child === slot.id);

    if (slot.role === "nucleo") {
      comprobar(conexiones.length === 0, `${nombre}: el núcleo "${slot.id}" no debe conectarse`);
      continue;
    }

    comprobar(
      conexiones.length === 1,
      `${nombre}: "${slot.id}" debe tener exactamente una conexión y tiene ${conexiones.length}`
    );

    if (conexiones.length === 1) {
      const padre = conexiones[0].parent;
      comprobar(
        familia.slots.some((otro) => otro.id === padre),
        `${nombre}: "${slot.id}" se conecta a "${padre}", que no existe`
      );
      comprobar(
        conexiones[0].angleRange &&
          typeof conexiones[0].angleRange.min === "number" &&
          typeof conexiones[0].angleRange.max === "number",
        `${nombre}: la conexión de "${slot.id}" no declara angleRange`
      );
    }
  }

  // Rangos bien declarados
  for (const slot of familia.slots) {
    comprobar(
      Object.keys(slot.ranges).length > 0,
      `${nombre}: el slot "${slot.id}" no declara ningún rango`
    );

    for (const [medida, rango] of Object.entries(slot.ranges)) {
      comprobar(rango.min > 0, `${nombre}: "${slot.id}" ${medida} tiene mínimo inválido`);
      comprobar(
        rango.max >= rango.min,
        `${nombre}: "${slot.id}" ${medida} tiene máximo menor que el mínimo`
      );
    }
  }
}

// ------------------------------------------------------------
// Forma canónica
// ------------------------------------------------------------

function verificarCanonica(familia, reporte) {
  const comprobar = comprobarEn(reporte);
  const nombre = familia.name;

  const partes = familia.canonical.parts;
  const slotsPorId = new Map(familia.slots.map((slot) => [slot.id, slot]));
  const conexionPorHijo = new Map(familia.connections.map((conexion) => [conexion.child, conexion]));

  // ------- 1. Los DATOS de la canónica contra los slots -------
  for (const parte of partes) {
    const slot = slotsPorId.get(parte.slotId);

    comprobar(Boolean(slot), `${nombre}: la canónica usa "${parte.slotId}", que no está declarado`);
    if (!slot) continue;

    // Cada valor declarado en los ranges tiene que estar y entrar en el rango
    for (const [medida, rango] of Object.entries(slot.ranges)) {
      const valor = parte[medida];

      comprobar(
        typeof valor === "number",
        `${nombre}: "${parte.slotId}" no tiene el valor "${medida}" que su slot declara`
      );

      if (typeof valor === "number") {
        comprobar(
          valor >= rango.min && valor <= rango.max,
          `${nombre}: "${parte.slotId}" ${medida}=${valor} está fuera del rango ${rango.min}–${rango.max}`
        );
      }
    }

    // Ángulo dentro del rango declarado en su conexión
    const conexion = conexionPorHijo.get(parte.slotId);
    if (conexion) {
      comprobar(
        typeof parte.angle === "number",
        `${nombre}: "${parte.slotId}" se conecta a "${conexion.parent}" pero no tiene ángulo`
      );

      if (typeof parte.angle === "number") {
        comprobar(
          parte.angle >= conexion.angleRange.min && parte.angle <= conexion.angleRange.max,
          `${nombre}: "${parte.slotId}" angle=${parte.angle} está fuera del angleRange ${conexion.angleRange.min}–${conexion.angleRange.max}`
        );
      }
    }
  }

  // ------- 2. Orden: el padre aparece antes que el hijo -------
  for (const parte of partes) {
    const conexion = conexionPorHijo.get(parte.slotId);
    if (!conexion) continue;

    const indiceHijo = partes.indexOf(parte);
    const indicePadre = partes.findIndex((otra) => otra.slotId === conexion.parent);

    comprobar(
      indicePadre >= 0,
      `${nombre}: el padre "${conexion.parent}" de "${parte.slotId}" no está en la canónica`
    );
    comprobar(
      indicePadre >= 0 && indicePadre < indiceHijo,
      `${nombre}: "${parte.slotId}" aparece antes que su padre "${conexion.parent}"`
    );
  }

  // ------- 3. Cantidad de partes por rol -------
  for (const [rol, rango] of Object.entries(familia.roles)) {
    const cantidad = partes.filter(
      (parte) => slotsPorId.get(parte.slotId)?.role === rol
    ).length;
    const esperado = valorMedioRedondeado(rango);

    comprobar(
      cantidad >= rango.min && cantidad <= rango.max,
      `${nombre}: rol "${rol}" tiene ${cantidad} partes, fuera de ${rango.min}–${rango.max}`
    );

    comprobar(
      cantidad === esperado,
      `${nombre}: rol "${rol}" tiene ${cantidad} partes y la regla del valor medio pide ${esperado}`
    );
  }

  // ------- 4. La forma construida -------
  let forma;
  let otraForma;

  try {
    forma = construirCanonica(familia);
    otraForma = construirCanonica(familia);
  } catch (error) {
    // Si el orden de la canónica está mal, construirCanonica tira error.
    // Lo convertimos en un fallo legible en vez de cortar el script.
    comprobar(false, `${nombre}: la canónica no se pudo construir -> ${error.message}`);
    reporte.detalle = "no se pudo construir";
    return;
  }

  comprobar(
    JSON.stringify(forma.parts) === JSON.stringify(otraForma.parts),
    `${nombre}: la canónica no es determinista`
  );

  comprobar(
    JSON.stringify(forma.parts.map((parte) => parte.id)) ===
      JSON.stringify(partes.map((parte) => parte.slotId)),
    `${nombre}: las partes construidas no coinciden con los slotId de la canónica`
  );

  const nucleos = forma.parts.filter((parte) => parte.role === "nucleo");
  comprobar(
    nucleos.length === 1,
    `${nombre}: la canónica debe tener 1 núcleo y tiene ${nucleos.length}`
  );

  for (const parte of forma.parts) {
    comprobar(
      parte.points.length >= 3,
      `${nombre}: "${parte.id}" tiene ${parte.points.length} puntos, se necesitan 3 o más`
    );

    const puntoInvalido = parte.points.some(
      (punto) => !Number.isFinite(punto.x) || !Number.isFinite(punto.y)
    );
    comprobar(!puntoInvalido, `${nombre}: "${parte.id}" tiene un punto inválido (NaN o Infinity)`);

    const slot = slotsPorId.get(parte.id);
    if (slot) {
      comprobar(parte.role === slot.role, `${nombre}: "${parte.id}" cambió de rol al construirse`);
      comprobar(parte.anchor === slot.anchor, `${nombre}: "${parte.id}" cambió de ancla al construirse`);
    }
  }

  comprobar(forma.bounds.width > 0, `${nombre}: la canónica tiene ancho 0`);
  comprobar(forma.bounds.height > 0, `${nombre}: la canónica tiene alto 0`);

  // La cabeza es una parte más y lleva sus dos ojos como decoración.
  const cabezas = forma.parts.filter((parte) => parte.role === "cabeza");
  comprobar(cabezas.length === 1, `${nombre}: debe tener 1 cabeza y tiene ${cabezas.length}`);

  if (cabezas.length === 1) {
    comprobar(
      cabezas[0].extras.length === 2,
      `${nombre}: la cabeza debe llevar 2 ojos y lleva ${cabezas[0].extras.length}`
    );
  }

  // Resumen legible para la salida
  reporte.detalle = Object.entries(familia.roles)
    .map(([rol]) => {
      const cantidad = forma.parts.filter((parte) => parte.role === rol).length;
      return `${rol} ${cantidad}`;
    })
    .join(" · ");
}

// ------------------------------------------------------------
// Programa principal
// ------------------------------------------------------------

const familias = FamilyRegistry.listFamilies();

verificarRegistro();

for (const familia of familias) {
  const reporte = crearReporte(familia.name);
  verificarDatos(familia, reporte);
  verificarCanonica(familia, reporte);
}

let totalComprobaciones = 0;
let totalErrores = 0;

for (const reporte of reportes) {
  totalComprobaciones += reporte.comprobaciones;
  totalErrores += reporte.errores.length;

  const estado = reporte.errores.length === 0 ? "OK   " : "FALLÓ";
  const detalle = reporte.detalle ? ` [${reporte.detalle}]` : "";

  console.log(`${estado}  ${reporte.nombre}${detalle} — ${reporte.comprobaciones} comprobaciones`);

  for (const error of reporte.errores) {
    console.log(`        ✗ ${error}`);
  }
}

console.log("");
if (totalErrores === 0) {
  console.log(`TODO OK — ${familias.length} familias · ${totalComprobaciones} comprobaciones · 0 errores`);
  process.exit(0);
} else {
  console.log(`FALLÓ — ${familias.length} familias · ${totalComprobaciones} comprobaciones · ${totalErrores} errores`);
  process.exit(1);
}
