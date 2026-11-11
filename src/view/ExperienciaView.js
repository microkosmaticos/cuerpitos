// ============================================================
// ExperienciaView.js
//
// LA VISTA de la experiencia final: cámara de fondo + organismos
// encima + HUD.
//
// - La cámara se dibuja con ajuste "cover" y SIN espejo (agent.md).
// - Cada organismo se ubica en el centro de SU persona, proyectado
//   con el mismo rectángulo que la cámara: así lo que se ve coincide
//   con el cuerpo detectado.
// - El tamaño del organismo sale del ancho de hombros de la persona.
// - Las emociones y comportamientos se traducen con efectos.js; esta
//   vista solo los aplica.
//
// La vista no decide nada: recibe todo ya calculado.
// ============================================================

import { calcularCubrir } from "./canvasFit.js";
import { colorDeRol } from "../model/palette/createPalette.js";
import { mostrarExtras, mostrarParte } from "../config/visual.js";
import { aplicarPose } from "../model/tracking/aplicarPose.js";
import { calcularEfecto } from "./efectos.js";

/** Fondos posibles, en orden de la tecla F. */
export const FONDOS = ["camara", "camara-velada", "arte"];

/** Ancho del organismo medido en anchos de hombros de su persona. */
const ANCHO_EN_HOMBROS = 1.7;

/** Tamaño mínimo y máximo del organismo, en fracción del canvas. */
const ANCHO_MINIMO = 0.12;
const ANCHO_MAXIMO = 0.5;

/** Alto máximo del organismo, en fracción del canvas. */
const ALTO_MAXIMO = 0.58;

/** Archivos del fondo artístico (mismo tablero de 2880 x 1800). */
const CAPAS = {
  base: "fondo-cuerpitos-01.svg",
  ondas: "fondo-ondas.png",
  estrellas: "fondo-estrellas.png",
};

const ARTE_ANCHO = 2880;
const ARTE_ALTO = 1800;

export class ExperienciaView {
  /**
   * @param {object} p instancia de p5 (modo instancia)
   */
  constructor(p) {
    this.p = p;
    this.fondo = "camara";
    this.mostrarDepuracion = false;
    this.mostrarHud = true;
    this.tiempo = 0;

    this.capas = null;
  }

  /** Se llama desde p.preload, antes de setup. */
  precargar() {
    const p = this.p;
    this.capas = {
      base: p.loadImage(CAPAS.base),
      ondas: p.loadImage(CAPAS.ondas),
      estrellas: p.loadImage(CAPAS.estrellas),
    };
  }

  // ------------------------------------------------------------
  // Controles
  // ------------------------------------------------------------

  cambiarFondo() {
    const indice = FONDOS.indexOf(this.fondo);
    this.fondo = FONDOS[(indice + 1) % FONDOS.length];
  }

  alternarDepuracion() {
    this.mostrarDepuracion = !this.mostrarDepuracion;
  }

  alternarHud() {
    this.mostrarHud = !this.mostrarHud;
  }

  // ------------------------------------------------------------
  // Dibujo principal
  // ------------------------------------------------------------

  /**
   * @param {object} datos
   * @param {object[]} datos.items organismos con pose y comportamiento
   * @param {object} datos.frame frame de tracking validado
   * @param {object} datos.camara CameraModel
   * @param {string} datos.session estado de la sesión de participantes
   * @param {number} datos.participantes cantidad de personas bloqueadas
   * @param {number} datos.fps
   * @param {string|null} datos.mensaje error o estado de carga
   */
  draw({
    items = [],
    frame = { persons: [] },
    camara = null,
    session = "SELECTING",
    participantes = 0,
    fps = 0,
    mensaje = null,
  }) {
    const p = this.p;
    this.tiempo = (p.deltaTime || 0) / 1000 + this.tiempo;

    const rect = this.rectDeCamara(camara);

    this.dibujarFondo(rect, camara);

    // Proyección de coordenadas normalizadas del video al canvas.
    this.proyectar = (punto) => ({
      x: rect.x + punto.x * rect.w,
      y: rect.y + punto.y * rect.h,
    });

    const personas = new Map(
      (frame?.persons ?? []).map((persona) => [persona.id, persona])
    );
    const personaDeOrganismo = new Map(
      items.map((item) => [item.organismo.id, item.personaId])
    );

    this.pantallas = new Map();
    this.partesPorOrganismo = new Map();

    for (const item of items) {
      const persona = personas.get(item.personaId) ?? null;
      const pareja = this.personaDePareja(
        item,
        personas,
        personaDeOrganismo
      );

      this.dibujarOrganismo(item, persona, rect, pareja);
    }

    if (this.mostrarDepuracion) {
      this.dibujarDepuracion({ items, frame });
    }

    if (this.mostrarHud) {
      this.dibujarHud({ items, session, participantes, fps, mensaje });
    }
  }

  /** Rectángulo donde se dibuja la cámara (cover). */
  rectDeCamara(camara) {
    const p = this.p;

    if (!camara?.ready) {
      return { x: 0, y: 0, w: p.width, h: p.height, escala: 1 };
    }

    return calcularCubrir(camara.width, camara.height, p.width, p.height);
  }

  // ------------------------------------------------------------
  // Fondos
  // ------------------------------------------------------------

  dibujarFondo(rect, camara) {
    const p = this.p;

    p.background(11, 11, 18);

    if (this.fondo === "arte") {
      this.dibujarArte();
      return;
    }

    if (camara?.ready && camara.video && camara.video.readyState >= 2) {
      // drawImage directo: p5.image no garantiza aceptar un <video> crudo.
      p.drawingContext.drawImage(camara.video, rect.x, rect.y, rect.w, rect.h);
    }

    // Capa de color para mejorar el contraste (agent.md, sección 9).
    const velo = this.fondo === "camara-velada" ? 0.42 : 0.14;
    p.noStroke();
    p.fill(16, 10, 30, 255 * velo);
    p.rect(0, 0, p.width, p.height);
  }

  dibujarArte() {
    const p = this.p;

    if (!this.capas) {
      p.background(150, 107, 169);
      return;
    }

    const rect = calcularCubrir(ARTE_ANCHO, ARTE_ALTO, p.width, p.height);

    for (const capa of [this.capas.base, this.capas.ondas, this.capas.estrellas]) {
      if (capa) p.image(capa, rect.x, rect.y, rect.w, rect.h);
    }

    p.noStroke();
    p.fill(10, 8, 22, 40);
    p.rect(0, 0, p.width, p.height);
  }

  // ------------------------------------------------------------
  // Organismos
  // ------------------------------------------------------------

  /** Persona del organismo con el que interactúa, si sigue presente. */
  personaDePareja(item, personas, personaDeOrganismo) {
    if (!item.parejaId) return null;

    const personaId = personaDeOrganismo.get(item.parejaId);
    if (!personaId) return null;

    return personas.get(personaId) ?? null;
  }

  dibujarOrganismo(item, persona, rect, parejaPersona = null) {
    const p = this.p;
    const forma = item.organismo.shape;

    if (!forma) return;

    const centro = persona
      ? this.proyectar(persona.center)
      : { x: p.width / 2, y: p.height / 2 };

    const hombros = this.anchoDeHombros(persona, rect);
    const anchoDeseado = hombros * ANCHO_EN_HOMBROS;
    const anchoAcotado = Math.min(
      Math.max(anchoDeseado, p.width * ANCHO_MINIMO),
      p.width * ANCHO_MAXIMO
    );

    const escalaPorAncho =
      forma.bounds.width > 0 ? anchoAcotado / forma.bounds.width : 1;
    const escalaPorAlto =
      forma.bounds.height > 0
        ? (p.height * ALTO_MAXIMO) / forma.bounds.height
        : Infinity;

    let escala = Math.min(escalaPorAncho, escalaPorAlto);

    // Easing de presencia: arranca y termina despacio.
    const suave = item.presencia * item.presencia * (3 - 2 * item.presencia);

    const efecto = calcularEfecto({
      emocion: item.emocion,
      comportamiento: item.comportamiento,
      progreso: item.progreso,
      tiempo: this.tiempo,
    });

    // Dirección hacia la pareja, para acercarse o alejarse.
    let hacia = { x: 0, y: 0 };
    if (parejaPersona) {
      const pareja = this.proyectar(parejaPersona.center);
      const dx = pareja.x - centro.x;
      const dy = pareja.y - centro.y;
      const distancia = Math.hypot(dx, dy) || 1;
      hacia = { x: dx / distancia, y: dy / distancia };
    }

    const impulso = hombros * 0.9;
    const jitter = Math.sin(this.tiempo * 34) * 0.09 * hombros * efecto.temblor;

    const centroX =
      centro.x +
      hacia.x * impulso * (efecto.acercar - efecto.alejar) +
      jitter;
    const centroY =
      centro.y +
      hacia.y * impulso * (efecto.acercar - efecto.alejar) -
      efecto.salto * hombros * 0.9;

    const escalaFinal = escala * (0.82 + 0.18 * suave) * efecto.escala;

    this.pantallas.set(item.organismo.id, (punto) => ({
      x: centroX + (punto.x - forma.bounds.x - forma.bounds.width / 2) * escalaFinal,
      y: centroY + (punto.y - forma.bounds.y - forma.bounds.height / 2) * escalaFinal,
    }));

    const partes = this.aplicarEfectosDePose(item, forma, efecto);
    this.partesPorOrganismo.set(item.organismo.id, partes);

    p.push();
    p.translate(centroX, centroY);
    p.rotate(efecto.rotacion);
    p.scale(escalaFinal);
    p.translate(-forma.bounds.x - forma.bounds.width / 2, -forma.bounds.y - forma.bounds.height / 2);

    const ordenadas = [...partes].sort((a, b) => pesoDeDibujo(a) - pesoDeDibujo(b));

    this.dibujarHalo(forma, item.organismo.palette, item, suave, efecto.halo);
    this.dibujarPartes(ordenadas, item.organismo.palette, suave);

    p.pop();
  }

  /**
   * Aplica la pose y, si el comportamiento pide una extremidad
   * autónoma, separa una parte del seguimiento (agent.md, sección 5).
   */
  aplicarEfectosDePose(item, forma, efecto) {
    const partes = aplicarPose(forma, item.pose);

    if (efecto.extremidad <= 0.01) return partes;

    const libres = partes.filter(
      (parte) => parte.role !== "nucleo" && parte.role !== "cabeza"
    );
    const hijas = new Set(partes.map((parte) => parte.parent).filter(Boolean));
    const hojas = libres.filter((parte) => !hijas.has(parte.id));
    const elegida = hojas[0] ?? libres[0];
    if (!elegida) return partes;

    const angulo = Math.sin(this.tiempo * 5.5) * 0.55 * efecto.extremidad;

    return partes.map((parte) => {
      if (parte.id !== elegida.id) return parte;

      const origen = parte.origenActual;
      const girar = (punto) => {
        const dx = punto.x - origen.x;
        const dy = punto.y - origen.y;
        const cos = Math.cos(angulo);
        const sin = Math.sin(angulo);
        return {
          x: origen.x + dx * cos - dy * sin,
          y: origen.y + dx * sin + dy * cos,
        };
      };

      return {
        ...parte,
        points: parte.points.map(girar),
        extras: (parte.extras ?? []).map((extra) => extra.map(girar)),
      };
    });
  }

  /** Ancho de hombros de la persona, en píxeles del canvas. */
  anchoDeHombros(persona, rect) {
    const izquierdo = persona?.anchors?.[0] ?? null;
    const derecho = persona?.anchors?.[1] ?? null;

    if (izquierdo && derecho) {
      const dx = (derecho.x - izquierdo.x) * rect.w;
      const dy = (derecho.y - izquierdo.y) * rect.h;
      const distancia = Math.hypot(dx, dy);
      if (distancia > 8) return distancia;
    }

    return this.p.width * 0.18;
  }

  /** Un solo degradado por organismo. */
  dibujarHalo(forma, palette, item, suave, factorHalo = 1) {
    const ctx = this.p.drawingContext;
    const caja = forma.bounds;
    const centroX = caja.x + caja.width / 2;
    const centroY = caja.y + caja.height / 2;
    const radio = Math.max(caja.width, caja.height) * 0.62;
    const halo = palette.colors.halo;

    let alfa = halo.a * suave * Math.max(0, factorHalo);

    if (item.estado === "desvaneciendo") {
      alfa += 0.18 * Math.sin(Math.PI * (1 - item.presencia));
    }

    const gradiente = ctx.createRadialGradient(
      centroX,
      centroY,
      radio * 0.1,
      centroX,
      centroY,
      radio
    );
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

      const gradiente = ctx.createRadialGradient(
        centro.x,
        centro.y,
        radio * 0.05,
        centro.x,
        centro.y,
        radio
      );
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

  // ------------------------------------------------------------
  // Depuración y HUD
  // ------------------------------------------------------------

  dibujarDepuracion({ items, frame }) {
    const p = this.p;

    for (const persona of frame?.persons ?? []) {
      persona.anchors.forEach((ancla, indice) => {
        if (!ancla) return;
        const punto = this.proyectar(ancla);

        p.noStroke();
        p.fill(0, 255, 200, 220);
        p.circle(punto.x, punto.y, 9);

        p.fill(0, 255, 200, 170);
        p.textSize(9);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(String(indice), punto.x + 7, punto.y - 4);
      });
    }

    for (const item of items) {
      const persona = (frame?.persons ?? []).find(
        (candidata) => candidata.id === item.personaId
      );
      const aPantalla = this.pantallas.get(item.organismo.id);
      const partes = this.partesPorOrganismo.get(item.organismo.id) ?? [];
      if (!persona || !aPantalla) continue;

      const partesPorId = new Map(partes.map((parte) => [parte.id, parte]));

      for (const vinculo of item.vinculos?.vinculos ?? []) {
        const parte = partesPorId.get(vinculo.partId);
        const ancla = persona.anchors[vinculo.ancla];
        if (!parte || !ancla) continue;

        const desde = aPantalla(parte.origenActual ?? parte.origen);
        const hasta = this.proyectar(ancla);

        p.stroke(0, 255, 200, 80);
        p.strokeWeight(1);
        p.line(desde.x, desde.y, hasta.x, hasta.y);
      }
    }
  }

  dibujarHud({ items, session, participantes, fps, mensaje }) {
    const p = this.p;

    p.noStroke();
    p.textAlign(p.LEFT, p.TOP);

    // Estado de la sesión de tracking.
    p.fill(255, 255, 255, 150);
    p.textSize(12);
    p.text(
      `${session} · ${participantes}/2 personas · ${fps} fps · fondo ${this.fondo}`,
      24,
      16
    );

    // Un renglón por organismo.
    items.forEach((item, indice) => {
      const y = 40 + indice * 38;

      p.fill(255, 255, 255, 235);
      p.textSize(13);
      p.text(`${item.organismo.shape?.name ?? item.organismo.familyId} · ${item.estado}`, 24, y);

      p.fill(255, 255, 255, 155);
      p.textSize(11);
      const comportamiento = item.comportamiento
        ? ` · ${item.comportamiento} ${(item.progreso * 100).toFixed(0)}%`
        : "";
      p.text(
        `emoción ${item.emocion}${comportamiento} · presencia ${item.presencia.toFixed(2)}`,
        24,
        y + 15
      );
    });

    if (items.length === 0) {
      p.fill(255, 255, 255, 170);
      p.textSize(13);
      p.text("esperando una persona de frente a la cámara…", 24, 42);
    }

    if (mensaje) {
      p.fill(0, 0, 0, 170);
      p.rect(p.width / 2 - 280, p.height / 2 - 30, 560, 60, 8);
      p.fill(255, 255, 255, 230);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(mensaje, p.width / 2, p.height / 2);
    }

    p.textAlign(p.LEFT, p.TOP);
    p.fill(255, 255, 255, 110);
    p.textSize(12);
    p.text("F fondo      D depuración      H ocultar HUD", 24, p.height - 26);
  }
}

// ------------------------------------------------------------
// Ayudas
// ------------------------------------------------------------

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
