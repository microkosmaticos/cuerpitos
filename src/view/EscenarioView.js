// ============================================================
// EscenarioView.js
//
// La VISTA del escenario. Dibuja los organismos con su paleta, su
// pose viva y su PRESENCIA (nacimiento y desaparición).
//
// La vista no decide estados ni tiempos: recibe la presencia ya
// calculada y solo la convierte en escala, opacidad y halo.
//
// La escala por presencia es UNIFORME para todo el organismo, así
// las proporciones nunca cambian.
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
    this.mostrarEventos = false;
    this.transformacion = null;
  }

  cambiarFondo() {
    const indice = FONDOS.indexOf(this.fondo);
    this.fondo = FONDOS[(indice + 1) % FONDOS.length];
  }

  alternarDepuracion() {
    this.mostrarDepuracion = !this.mostrarDepuracion;
  }

  alternarEventos() {
    this.mostrarEventos = !this.mostrarEventos;
  }

  /**
   * @param {object} datos { items, frame, modo, pendientes, eventos }
   */
  draw({ items, frame, modo, pendientes, eventos }) {
    const p = this.p;

    this.dibujarFondo();

    const columnas = Math.max(1, items.length);
    const ancho = p.width / columnas;

    items.forEach((item, indice) => {
      this.dibujarOrganismo(item, indice * ancho, 0, ancho, p.height);
    });

    const persona = frame?.persons[0] ?? null;

    if (this.mostrarDepuracion && items.length > 0 && persona) {
      dibujarDepuracion(p, {
        frame,
        persona,
        partes: this.ultimasPartes ?? [],
        vinculos: items[0].vinculos,
        aPantalla: (punto) => this.aPantalla(punto),
      });
    }

    this.dibujarHud({ items, modo, pendientes, eventos });
  }

  // ------------------------------------------------------------
  // Organismos
  // ------------------------------------------------------------

  dibujarOrganismo(item, x, y, ancho, alto) {
    const p = this.p;
    const forma = item.organismo.shape;
    const ajuste = calcularAjuste(forma.bounds, ancho, alto, 110);

    // Easing: arranca y termina despacio.
    const suave = item.presencia * item.presencia * (3 - 2 * item.presencia);

    // Escala uniforme de todo el organismo: nunca cambia proporciones.
    const escalaPresencia = 0.82 + 0.18 * suave;

    const centroX = x + ancho / 2 + item.pose.posicion.x * p.width;
    const centroY = y + alto / 2 + item.pose.posicion.y * p.height;

    this.transformacion = {
      centroX,
      centroY,
      escala: ajuste.escala * escalaPresencia,
      formaCentroX: ajuste.centroX,
      formaCentroY: ajuste.centroY,
    };

    const partes = aplicarPose(forma, item.pose);
    this.ultimasPartes = partes;

    p.push();
    p.translate(centroX, centroY);
    p.scale(ajuste.escala * escalaPresencia);
    p.translate(-ajuste.centroX, -ajuste.centroY);

    const ordenadas = [...partes].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    this.dibujarHalo(forma, item.organismo.palette, item, suave);
    this.dibujarPartes(ordenadas, item.organismo.palette, suave);

    p.pop();
  }

  /** Un solo degradado por organismo. */
  dibujarHalo(forma, palette, item, suave) {
    const ctx = this.p.drawingContext;
    const caja = forma.bounds;
    const centroX = caja.x + caja.width / 2;
    const centroY = caja.y + caja.height / 2;
    const radio = Math.max(caja.width, caja.height) * 0.58;
    const halo = palette.colors.halo;

    let alfa = halo.a * suave;

    // Último destello al desvanecerse.
    if (item.estado === "desvaneciendo") {
      alfa += 0.18 * Math.sin(Math.PI * (1 - item.presencia));
    }

    const gradiente = ctx.createRadialGradient(centroX, centroY, radio * 0.1, centroX, centroY, radio);
    gradiente.addColorStop(0, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, ${alfa})`);
    gradiente.addColorStop(1, `hsla(${halo.h}, ${halo.s}%, ${halo.l}%, 0)`);

    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio, 0, Math.PI * 2);
    ctx.fill();
  }

  dibujarPartes(partes, palette, suave) {
    const ctx = this.p.drawingContext;
    ctx.globalAlpha = 0.92 * suave;

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

  // ------------------------------------------------------------
  // Fondos y textos
  // ------------------------------------------------------------

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

  dibujarHud({ items, modo, pendientes, eventos }) {
    const p = this.p;
    p.noStroke();
    p.textAlign(p.LEFT, p.TOP);

    p.fill(255, 255, 255, 150);
    p.textSize(12);
    p.text(`mock ${modo} · fondo ${this.fondo} · ${items.length} organismo(s)`, 24, 16);

    items.forEach((item, indice) => {
      const y = 40 + indice * 44;

      p.fill(255, 255, 255, 235);
      p.textSize(13);
      p.text(
        `${item.organismo.shape.name} · ${item.estado} · presencia ${item.presencia.toFixed(2)}`,
        24,
        y
      );

      p.fill(255, 255, 255, 150);
      p.textSize(11);
      p.text(
        `semilla ${item.organismo.seed} · paleta ${item.organismo.palette.nombre} · sin señal ${item.tiempoSinPresencia.toFixed(2)} s`,
        24,
        y + 16
      );
    });

    if (pendientes.length > 0) {
      p.fill(0, 255, 200, 180);
      p.textSize(11);
      const texto = pendientes
        .map((pendiente) => `${pendiente.personaId}: ${pendiente.tiempo.toFixed(2)} s`)
        .join("  ");
      p.text(`confirmando → ${texto}`, 24, 40 + items.length * 44);
    }

    if (this.mostrarEventos) {
      p.fill(0, 0, 0, 160);
      p.rect(p.width - 300, 16, 284, 24 + Math.min(8, eventos.length) * 16, 6);

      p.fill(0, 255, 200, 220);
      p.textSize(11);
      p.text("eventos", p.width - 288, 24);

      eventos.slice(-8).forEach((evento, indice) => {
        p.fill(255, 255, 255, 180);
        p.text(
          `${evento.tipo} · semilla ${evento.semilla}`,
          p.width - 288,
          42 + indice * 16
        );
      });
    }

    p.fill(255, 255, 255, 120);
    p.textSize(12);
    p.text(
      "1–5 modo      D depuración      E eventos      F fondo      ESPACIO nueva semilla",
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
