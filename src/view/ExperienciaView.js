// ============================================================
// ExperienciaView.js
//
// LA VISTA de la experiencia final: organismos encima del fondo
// artístico + HUD.
//
// Todo es AUTOMÁTICO: no hay teclas ni modos. El fondo lo pinta
// FondoArtistico.js (la composición de enviroment.js) antes de esta
// vista; acá solo se dibujan los organismos y el HUD.
//
// - La cámara no se muestra: solo se usa para detectar. El fondo es
//   la obra de enviroment.js.
// - Cada organismo se ubica en el centro de SU persona, proyectado
//   con el rectángulo "cover" del video de la cámara: la posición en
//   pantalla respeta dónde está la persona.
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
import { CICLO } from "../config/ciclo.js";
import { calcularEfecto } from "./efectos.js";

/** Ancho del organismo medido en anchos de hombros de su persona. */
const ANCHO_EN_HOMBROS = 1.7;

/** Tamaño mínimo y máximo del organismo, en fracción del canvas. */
const ANCHO_MINIMO = 0.12;
const ANCHO_MAXIMO = 0.5;

/** Alto máximo del organismo, en fracción del canvas. */
const ALTO_MAXIMO = 0.58;

export class ExperienciaView {
  /**
   * @param {object} p instancia de p5 (modo instancia)
   */
  constructor(p) {
    this.p = p;
    this.tiempo = 0;
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
   * @param {object} datos.diagnostico detecciones, confianza y candidatos
   * @param {string|null} datos.mensaje error o estado de carga
   */
  draw({
    items = [],
    frame = { persons: [] },
    camara = null,
    session = "SELECTING",
    participantes = 0,
    fps = 0,
    diagnostico = {},
    mensaje = null,
    error = false,
  }) {
    const p = this.p;
    this.tiempo += (p.deltaTime || 0) / 1000;

    const rect = this.rectDeCamara(camara);
    this.ultimoVideo =
      camara?.ready && camara.video && Number.isFinite(camara.video.currentTime)
        ? camara.video.currentTime
        : null;

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

    for (const item of items) {
      const persona = personas.get(item.personaId) ?? null;
      const pareja = this.personaDePareja(item, personas, personaDeOrganismo);

      this.dibujarOrganismo(item, persona, rect, pareja);
    }

    this.dibujarHud({
      items,
      session,
      participantes,
      fps,
      diagnostico,
      mensaje,
      error,
    });
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

    const partes = this.aplicarEfectosDePose(item, forma, efecto);

    p.push();
    p.translate(centroX, centroY);
    p.rotate(efecto.rotacion);
    p.scale(escalaFinal);
    p.translate(
      -forma.bounds.x - forma.bounds.width / 2,
      -forma.bounds.y - forma.bounds.height / 2
    );

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
  // HUD
  // ------------------------------------------------------------

  dibujarHud({ items, session, participantes, fps, diagnostico, mensaje, error }) {
    const p = this.p;
    const minimo = CICLO.presencia.confianzaMinima;

    // Panel tenue detrás del texto: el fondo artístico es luminoso.
    const altoPanel = 26 + (items.length === 0 ? 56 : 56 + items.length * 38);
    p.noStroke();
    p.fill(8, 6, 20, 105);
    p.rect(12, 8, 430, altoPanel, 10);

    p.textAlign(p.LEFT, p.TOP);

    // Estado del tracking, siempre visible y sin teclas.
    p.fill(255, 255, 255, 150);
    p.textSize(12);
    p.text(
      `${session} · ${participantes}/2 personas · ${fps} fps · ${diagnostico.detecciones ?? 0} detecciones`,
      24,
      16
    );

    const video = this.ultimoVideo;
    p.fill(255, 255, 255, 120);
    p.textSize(11);
    p.text(
      `anclas ${diagnostico.anclas ?? 0}/7 · energía ${(diagnostico.energia ?? 0).toFixed(2)}` +
        (video === null ? "" : ` · video ${video.toFixed(1)} s`),
      24,
      34
    );

    if (items.length === 0 && !mensaje) {
      p.fill(255, 255, 255, 190);
      p.textSize(13);
      p.text(this.explicacionDeEspera(diagnostico, minimo), 24, 54);
    }

    // Un renglón por organismo.
    items.forEach((item, indice) => {
      const y = 74 + indice * 38;

      p.fill(255, 255, 255, 235);
      p.textSize(13);
      p.text(
        `${item.organismo.shape?.name ?? item.organismo.familyId} · ${item.estado}`,
        24,
        y
      );

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

    // Mientras carga, el estado va en el HUD. Solo un error final
    // ocupa el centro de la pantalla.
    if (mensaje && !error) {
      p.fill(255, 226, 160, 220);
      p.textSize(11);
      p.text(mensaje, 24, 50);
    }

    if (mensaje && error) {
      p.fill(0, 0, 0, 190);
      p.rect(p.width / 2 - 320, p.height / 2 - 40, 640, 80, 10);
      p.fill(255, 180, 180, 240);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(mensaje, p.width / 2, p.height / 2);
      p.textAlign(p.LEFT, p.TOP);
    }
  }

  /** Por qué todavía no hay organismo, en una línea. */
  explicacionDeEspera(diagnostico, minimo) {
    const detecciones = diagnostico.detecciones ?? 0;
    const confianza = diagnostico.mejorConfianza ?? 0;

    if (detecciones === 0) {
      return "buscando una persona: ponete de frente a la cámara, de cintura para arriba";
    }

    if (confianza < minimo) {
      return `persona detectada con confianza ${confianza.toFixed(2)} (hace falta ${minimo.toFixed(2)}): acercate un poco`;
    }

    if ((diagnostico.candidatos ?? 0) === 0) {
      return "persona detectada: pasá al centro del cuadro y quedate quieto un segundo";
    }

    return "confirmando persona…";
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
