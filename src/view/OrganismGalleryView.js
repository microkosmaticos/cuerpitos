// ============================================================
// OrganismGalleryView.js
//
// La VISTA de los organismos. Recibe organismos ya construidos
// (con su paleta) y los dibuja.
//
// Estilo luminoso, como pide agent.md:
//   - degradado radial en cada masa: claro (centro) → color → oscuro
//   - un halo suave detrás de cada organismo
//   - transparencia parcial para que las partes se mezclen
//   - brillo fino en el borde
//
// Rendimiento: NO se usa blur ni shadowBlur por parte (son carísimos).
// El único efecto "difuso" es UN degradado por organismo (el halo).
//
// La vista NO decide colores: los recibe en organismo.palette.
// Tampoco usa Math.random(): el fondo de cámara es fijo y animado
// con frameCount.
// ============================================================

import { calcularAjuste } from "./canvasFit.js";
import { colorDeRol } from "../model/palette/createPalette.js";
import { mostrarExtras, mostrarParte } from "../config/visual.js";

const FONDOS = ["oscuro", "medio", "camara"];

// Manchas del fondo "cámara": posiciones, tamaños y colores FIJOS.
const MANCHAS = [
  { x: 0.18, y: 0.22, r: 0.34, rgb: "255, 214, 170", alfa: 0.35, vaiven: 0.02, fase: 0 },
  { x: 0.78, y: 0.28, r: 0.28, rgb: "150, 190, 255", alfa: 0.3, vaiven: 0.03, fase: 2 },
  { x: 0.62, y: 0.78, r: 0.4, rgb: "120, 130, 120", alfa: 0.28, vaiven: 0.02, fase: 4 },
  { x: 0.3, y: 0.7, r: 0.24, rgb: "230, 200, 220", alfa: 0.22, vaiven: 0.025, fase: 1 },
];

export class OrganismGalleryView {
  constructor(p) {
    this.p = p;
    this.fondo = "oscuro";
  }

  /** Pasa al siguiente fondo de prueba. */
  cambiarFondo() {
    const indice = FONDOS.indexOf(this.fondo);
    this.fondo = FONDOS[(indice + 1) % FONDOS.length];
  }

  get nombreFondo() {
    return this.fondo;
  }

  /**
   * @param {object[]} organismos en modo "uno" se usa el primero
   * @param {"uno"|"seis"} modo
   */
  draw(organismos, modo) {
    this.dibujarFondo();

    if (modo === "seis") {
      this.dibujarGrilla(organismos);
    } else {
      const organismo = organismos[0];
      this.dibujarOrganismo(organismo, 0, 0, this.p.width, this.p.height, 120);
      this.dibujarHud(organismo);
    }

    this.dibujarAyuda(modo);
  }

  // ------------------------------------------------------------
  // Fondos
  // ------------------------------------------------------------

  dibujarFondo() {
    const p = this.p;
    const ctx = p.drawingContext;

    if (this.fondo === "oscuro") {
      p.background(11, 11, 18);
      return;
    }

    if (this.fondo === "medio") {
      p.background(122, 122, 133);
      return;
    }

    // Cámara simulada: degradado + manchas que se mueven despacio.
    const fondo = ctx.createLinearGradient(0, 0, 0, p.height);
    fondo.addColorStop(0, "#3a3f4a");
    fondo.addColorStop(1, "#6b6455");
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, p.width, p.height);

    for (const mancha of MANCHAS) {
      const x = (mancha.x + Math.cos(p.frameCount * 0.004 + mancha.fase) * mancha.vaiven) * p.width;
      const y = (mancha.y + Math.sin(p.frameCount * 0.003 + mancha.fase) * mancha.vaiven) * p.height;
      const radio = mancha.r * p.width;

      const gradiente = ctx.createRadialGradient(x, y, 0, x, y, radio);
      gradiente.addColorStop(0, `rgba(${mancha.rgb}, ${mancha.alfa})`);
      gradiente.addColorStop(1, `rgba(${mancha.rgb}, 0)`);

      ctx.fillStyle = gradiente;
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------
  // Organismos
  // ------------------------------------------------------------

  dibujarGrilla(organismos) {
    const p = this.p;
    const columnas = 3;
    const filas = 2;
    const ancho = p.width / columnas;
    const alto = p.height / filas;

    organismos.forEach((organismo, indice) => {
      const x = (indice % columnas) * ancho;
      const y = Math.floor(indice / columnas) * alto;

      this.dibujarOrganismo(organismo, x, y, ancho, alto, 40);
      this.dibujarEtiquetaChica(organismo, x + 12, y + 10);
    });
  }

  /** Dibuja un organismo con su paleta dentro de un rectángulo. */
  dibujarOrganismo(organismo, x, y, ancho, alto, margen) {
    const p = this.p;
    const forma = organismo.shape;
    const ajuste = calcularAjuste(forma.bounds, ancho, alto, margen);

    p.push();
    p.translate(x + ancho / 2, y + alto / 2);
    p.scale(ajuste.escala);
    p.translate(-ajuste.centroX, -ajuste.centroY);

    this.dibujarHalo(forma, organismo.palette);
    this.dibujarPartes(forma, organismo.palette);

    p.pop();
  }

  /** Un solo degradado por organismo: resplandor barato. */
  dibujarHalo(forma, palette) {
    const ctx = this.p.drawingContext;
    const caja = forma.bounds;
    const centroX = caja.x + caja.width / 2;
    const centroY = caja.y + caja.height / 2;
    const radio = Math.max(caja.width, caja.height) * 0.58;
    const halo = palette.colors.halo;

    const gradiente = ctx.createRadialGradient(centroX, centroY, radio * 0.1, centroX, centroY, radio);
    gradiente.addColorStop(0, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, ${halo.a})`);
    gradiente.addColorStop(0.55, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, ${halo.a * 0.35})`);
    gradiente.addColorStop(1, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, 0)`);

    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio, 0, Math.PI * 2);
    ctx.fill();
  }

  dibujarPartes(forma, palette) {
    const p = this.p;
    const ctx = p.drawingContext;

    // Primero extremidades, después cabeza, al final el núcleo.
    const ordenadas = [...forma.parts].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    ctx.globalAlpha = 0.92;

    for (const parte of ordenadas) {
      if (!mostrarParte(parte)) continue;

      const color = colorDeRol(palette, parte.role);
      const centro = centroide(parte.points);
      const radio = radioMaximo(parte.points, centro);

      // Degradado: claro en el centro, el color en el medio y oscuro en el borde.
      const gradiente = ctx.createRadialGradient(centro.x, centro.y, radio * 0.05, centro.x, centro.y, radio);
      gradiente.addColorStop(0, palette.colors.claro.css);
      gradiente.addColorStop(0.55, color.css);
      gradiente.addColorStop(1, palette.colors.oscuro.css);

      ctx.beginPath();
      ctx.moveTo(parte.points[0].x, parte.points[0].y);
      for (let i = 1; i < parte.points.length; i++) {
        ctx.lineTo(parte.points[i].x, parte.points[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = gradiente;
      ctx.fill();

      // Brillo fino del borde.
      ctx.strokeStyle = `hsla(${palette.colors.claro.h}, ${palette.colors.claro.s}%, ${palette.colors.claro.l}%, 0.4)`;
      ctx.lineWidth = Math.max(0.5, radio * 0.02);
      ctx.stroke();

      // Los ojos viajan pegados a la cabeza.
      ctx.globalAlpha = 0.85;
      if (mostrarExtras()) {
        for (const extra of parte.extras ?? []) {
          ctx.beginPath();
          ctx.moveTo(extra[0].x, extra[0].y);
          for (let i = 1; i < extra.length; i++) ctx.lineTo(extra[i].x, extra[i].y);
          ctx.closePath();
          ctx.fillStyle = "rgba(18, 18, 26, 0.9)";
          ctx.fill();
        }
      }
      ctx.globalAlpha = 0.92;
    }

    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------
  // Textos
  // ------------------------------------------------------------

  dibujarHud(organismo) {
    const p = this.p;
    const palette = organismo.palette;

    p.noStroke();
    p.fill(255, 255, 255, 235);
    p.textSize(16);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`${organismo.shape.name}`, 24, 18);

    p.fill(255, 255, 255, 150);
    p.textSize(12);
    p.text(
      `paleta ${palette.nombre} · semilla ${organismo.seed} · fondo ${this.fondo}`,
      24,
      42
    );

    this.dibujarMuestras(palette, 24, 66);
  }

  /** Cinco cuadraditos con el color de cada rol. */
  dibujarMuestras(palette, x, y) {
    const p = this.p;
    const roles = ["base", "acento", "claro", "oscuro", "halo"];
    const tamano = 20;
    const separacion = 16;

    p.noStroke();

    roles.forEach((rol, indice) => {
      const color = palette.colors[rol];
      const posicionX = x + indice * (tamano + separacion);

      p.fill(color.css);
      p.rect(posicionX, y, tamano, tamano, 3);

      p.fill(255, 255, 255, 130);
      p.textSize(10);
      p.text(rol, posicionX, y + tamano + 3);
    });
  }

  dibujarEtiquetaChica(organismo, x, y) {
    const p = this.p;
    p.noStroke();
    p.fill(255, 255, 255, 225);
    p.textSize(11);
    p.textAlign(p.LEFT, p.TOP);
    p.text(organismo.shape.name, x, y);

    p.fill(255, 255, 255, 120);
    p.textSize(9);
    p.text(`semilla ${organismo.seed}`, x, y + 13);
  }

  dibujarAyuda(modo) {
    const p = this.p;
    p.noStroke();
    p.fill(255, 255, 255, 120);
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);

    const ayuda =
      modo === "seis"
        ? `ESPACIO  otros seis      G  volver a uno      F  fondo: ${this.fondo}`
        : `ESPACIO  nacer otro      G  ver seis      F  fondo: ${this.fondo}`;

    p.text(ayuda, 24, p.height - 28);
  }
}

/** 0 = extremidades, 1 = cabeza, 2 = núcleo. */
function pesoDeDibujo(parte) {
  if (parte.role === "nucleo") return 2;
  if (parte.role === "cabeza") return 1;
  return 0;
}

function centroide(puntos) {
  let sumaX = 0;
  let sumaY = 0;
  for (const punto of puntos) {
    sumaX += punto.x;
    sumaY += punto.y;
  }
  return { x: sumaX / puntos.length, y: sumaY / puntos.length };
}

function radioMaximo(puntos, centro) {
  let maximo = 0;
  for (const punto of puntos) {
    const distancia = Math.hypot(punto.x - centro.x, punto.y - centro.y);
    if (distancia > maximo) maximo = distancia;
  }
  return maximo || 1;
}
