# Cuerpitos — release 0.1.0

Experiencia de organismos digitales generativos sobre la cámara web.
Esta rama unifica todo el trabajo del proyecto en una sola versión
probable.

## Cómo probarla

La cámara necesita un contexto seguro (`localhost` o `https`). Abrir el
archivo con `file://` no funciona.

```bash
npm run serve          # python3 -m http.server 8080
# o
python3 -m http.server 8080
```

Después abrir <http://localhost:8080/>.

La primera vez hay que dar permiso de cámara. El modelo de pose (ml5)
tarda unos segundos en cargar; el HUD lo muestra.

### Controles

| Tecla | Acción |
| --- | --- |
| `F` | Cambia el fondo: cámara → cámara velada → fondo artístico |
| `D` | Muestra los anclas del tracking y los vínculos parte ↔ ancla |
| `H` | Oculta/muestra el HUD |

## Qué hay en la experiencia

```
cámara  →  ml5 bodyPose (MoveNet MULTIPOSE)  →  ParticipantTracker
        →  TrackingAdapter (contrato de 7 anclas, 0..1)
        →  OrganismManager (nacimiento, gracia, desvanecimiento)
        →  BehaviorBridge (emociones, eventos, ritmo social)
        →  OrganismPose (pose viva)  →  ExperienciaView
```

- **Hasta dos personas.** El `ParticipantTracker` bloquea a las dos más
  estables dentro de la zona central. Las demás no participan.
- **Un organismo por persona**, emparejado por un id estable y con una
  identidad generativa nueva en cada nacimiento (familia, paleta y
  semilla propias).
- **Respuesta al movimiento** por el contrato de tracking de 7 anclas:
  hombros, codos, muñecas y cintura. Quieto = organismo quieto.
- **Comportamientos**: el motor de reacciones elige eventos según
  pesos, compatibilidad y tiempos de espera. El `SocialPacer` cambia
  emociones y relaciones cada tanto (y según la distancia entre las
  personas) para que las interacciones realmente ocurran.
- **Sin espejo**: la imagen y los datos conservan la orientación real
  de la cámara, como pide `agent.md`.
- **Sin rostro**: los ojos decorativos de los organismos están
  apagados.

## Páginas

| Página | Para qué |
| --- | --- |
| `index.html` | La experiencia completa |
| `escenario.html` | Ciclo de vida con el mock, sin cámara (`?seed=`, teclas 1–8) |
| `formas.html` | Visor de formas del Paso A (flechas / A-D) |
| `galeria.html` | Canónicas de las familias |
| `organismos.html` | Galería de organismos generados |
| `fondo.html` | Fondo artístico animado (olas y estrellas) |
| `esqueleto.html` | Depuración del tracking: esqueleto y participantes |

## Pruebas

```bash
npm test
```

Corre:

- `tests/participants.test.js` — bloqueo de participantes;
- `reaccions.test.mjs` — catálogo, estados, selección y motor;
- `tests/verificar-*.mjs` — familias, paletas, genomas, composición,
  ciclo de vida, tracking, adaptador, comportamientos y la integración
  completa con el mock.

Las pruebas no necesitan cámara ni navegador.

## Pendiente / decisiones

- **Sonido**: no está implementado. `agent.md` pide música ambiental y
  efectos; no hay assets todavía. El HUD y los eventos ya exponen los
  ganchos (`nacio`, `desaparecio`, directivas de comportamiento).
- **Modelo de pose**: se usa ml5 `bodyPose` con MoveNet MULTIPOSE, no
  MediaPipe Pose Landmarker. Cumple la detección de hasta dos personas
  con ids estables; ml5 también ofrece BlazePose (MediaPipe) cambiando
  `CONFIG.model.name`.
- **Espejo**: la versión de `bodypose/develop` dibujaba el esqueleto en
  espejo. Acá se sigue `agent.md`: la imagen no se voltea.
- **Texturas**: las familias actuales son formas planas con degradado y
  halo; no hay texturas de imagen.

## Mapa del código

```
camera.js, bodypose.js, participants.js, pose.js, config.js, skeleton-view.js
   Tracking real de la etapa 1 (se conserva tal cual).
reaccions.js
   Catálogo de emociones/relaciones/eventos y motor de selección.
src/input/TrackingAdapter.js
   Participantes reales → frame del contrato de tracking.
src/model/**
   Familias, paletas, genomas, ciclo de vida, pose viva. Determinista.
src/behavior/BehaviorBridge.js
   Alta/baja de organismos y directivas → estado visual.
src/behavior/SocialPacer.js
   Emociones espontáneas y relaciones de pareja.
src/view/ExperienciaView.js
   Cámara de fondo, organismos encima, HUD y depuración.
src/view/efectos.js
   Emociones y comportamientos → números para la vista.
src/controller/ExperienciaController.js
   Orquesta todo el cuadro (sin p5, testeable).
src/experiencia.js
   Punto de entrada de index.html.
```
