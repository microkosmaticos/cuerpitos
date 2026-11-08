// ============================================================
// EscenarioView.js
//
// La VISTA del escenario: dibuja el organismo con su paleta y la
// pose viva. No calcula nada de movimiento: recibe la pose ya hecha.
//
// El modo depuración muestra los anchors del tracking, una línea
// desde cada parte hasta su ancla y los valores de energía y
// confianza. Vive en TrackingDebugView.js.
// ============================================================

import { calcularAjuste } from "./canvasFit.js";
import { colorDeRol } from "../model/palette/createPalette.js";
import { mostrarExtras, mostrarParte } from "../config/visual.js";
import { aplicarPose } from "../model/tracking/aplicarPose.js";
import { dibujarDepuracion } from "./TrackingDebugView.js";

const FONDOS = ["oscuro", "medio", "camara"];

export class EscenarioView {
  constructor(p) {
    this.p = p;
    this.fondo = "oscuro";
    this.mostrarDepuracion = true;
    this.transformacion = null;
  }

  cambiarFondo() {
    const indice = FONDOS.indexOf(this.fondo);
    this.fondo = FONDOS[(indice + 1) % FONDOS.length];
  }

  alternarDepuracion() {
    this.mostrarDepuracion = !this.mostrarDepuracion;
  }

  /**
   * @param {object} datos { organismo, pose, frame, vinculos, modo }
   */
  draw({ organismo, pose, frame, vinculos, modo }) {
    const p = this.p;

    this.dibujarFondo();

    const forma = organismo.shape;
    const ajuste = calcularAjuste(forma.bounds, p.width, p.height, 110);

    const centroX = p.width / 2 + pose.posicion.x * p.width;
    const centroY = p.height / 2 + pose.posicion.y * p.height;

    this.transformacion = {
      centroX,
      centroY,
      escala: ajuste.escala,
      formaCentroX: ajuste.centroX,
      formaCentroY: ajuste.centroY,
    };

    const partes = aplicarPose(forma, pose);

    p.push();
    p.translate(centroX, centroY);
    p.scale(ajuste.escala);
    p.translate(-ajuste.centroX, -ajuste.centroY);

    const ordenadas = [...partes].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    this.dibujarHalo(forma, organismo.palette);
    this.dibujarPartes(ordenadas, organismo.palette);

    p.pop();

    const persona = frame.persons[0] ?? null;

    if (this.mostrarDepuracion) {
      dibujarDepuracion(this.p, {
        frame,
        persona,
        partes,
        vinculos,
        aPantalla: (punto) => this.aPantalla(punto),
      });
    }

    this.dibujarHud({ organismo, persona, modo, pose });
  }

  /** Resplandor suave detrás del organismo (uno solo, barato). */
  dibujarHalo(forma, palette) {
    const ctx = this.p.drawingContext;
    const caja = forma.bounds;
    const centroX = caja.x + caja.width / 2;
    const centroY = caja.y + caja.height / 2;
    const radio = Math.max(caja.width, caja.height) * 0.58;
    const halo = palette.colors.halo;

    const gradiente = ctx.createRadialGradient(centroX, centroY, radio * 0.1, centroX, centroY, radio);
    gradiente.addColorStop(0, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, ${halo.a})`);
    gradiente.addColorStop(1, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, 0)`);

    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Cada parte con degradado claro → color → oscuro y brillo de borde. */
  dibujarPartes(partes, palette) {
    const ctx = this.p.drawingContext;
    ctx.globalAlpha = 0.92;

    for (const parte of partes) {
      if (!mostrarParte(parte)) continue;

      const color = colorDeRol(palette, parte.role);
      const centro = centroide(parte.points);
      const radio = radioMaximo(parte.points, centro);

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

      ctx.strokeStyle = `hsla(${palette.colors.claro.h}, ${palette.colors.claro.s}%, ${palette.colors.claro.l}%, 0.4)`;
      ctx.lineWidth = Math.max(0.5, radio * 0.02);
      ctx.stroke();

      if (!mostrarExtras()) continue;
      for (const extra of parte.extras ?? []) {
        ctx.beginPath();
        ctx.moveTo(extra[0].x, extra[0].y);
        for (let i = 1; i < extra.length; i++) ctx.lineTo(extra[i].x, extra[i].y);
        ctx.closePath();
        ctx.fillStyle = "rgba(18, 18, 26, 0.9)";
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  /** Convierte un punto del espacio de la forma a píxeles de pantalla. */
  aPantalla(punto) {
    const t = this.transformacion;
    if (!t) return { x: 0, y: 0 };

    return {
      x: t.centroX + (punto.x - t.formaCentroX) * t.escala,
      y: t.centroY + (punto.y - t.formaCentroY) * t.escala,
    };
  }

  dibujarFondo() {
    const p = this.p;

    if (this.fondo === "medio") {
      p.background(122, 122, 133);
      return;
    }

    if (this.fondo === "camara") {
      p.background(70, 72, 66);
      p.noStroke();
      p.fill(120, 110, 90, 90);
      p.ellipse(p.width * 0.3, p.height * 0.35, p.width * 0.6);
      p.fill(90, 105, 130, 80);
      p.ellipse(p.width * 0.75, p.height * 0.6, p.width * 0.5);
      return;
    }

    p.background(11, 11, 18);
  }

  dibujarHud({ organismo, persona, modo, pose }) {
    const p = this.p;

    p.noStroke();
    p.fill(255, 255, 255, 235);
    p.textSize(15);
    p.textAlign(p.LEFT, p.TOP);
    p.text(organismo.shape.name, 24, 16);

    p.fill(255, 255, 255, 150);
    p.textSize(12);
    p.text(
      `semilla ${organismo.seed} · mock ${modo} · fondo ${this.fondo} · señal ${pose.estadoSenal}`,
      24,
      40
    );

    p.text(
      `energía ${persona ? persona.energy.toFixed(2) : "—"} · confianza ${
        persona ? persona.confidence.toFixed(2) : "—"
      } · ${this.mostrarDepuracion ? "depuración ON" : "depuración OFF"}`,
      24,
      58
    );

    p.fill(255, 255, 255, 120);
    p.textSize(12);
    p.text(
      "1–5 modo del mock      D depuración      F fondo      ESPACIO nueva semilla",
      24,
      p.height - 26
    );
  }
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

function pesoDeDibujo(parte) {
  if (parte.role === "nucleo") return 2;
  if (parte.role === "cabeza") return 1;
  return 0;
}
