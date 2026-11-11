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

### Arranque automático

No hay teclas ni modos que activar. Al abrir la página:

1. se enciende la cámara y se muestra como fondo;
2. se carga el modelo de pose;
3. en cuanto una persona queda estable en el cuadro, nace su organismo;
4. los comportamientos y las emociones empiezan solos.

Si algo falla, la experiencia reintenta sola (3 veces) y el HUD explica el motivo.
Si no aparece ningún organismo, el HUD dice qué falta: cuántas detecciones ve el
modelo, con qué confianza, y si la persona ya está en la zona de participación.

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
- **Video en el DOM**: el `<video>` de la cámara se muestra detrás de un canvas
  transparente. Si se oculta con `display:none`, Firefox deja de decodificar
  cuadros y el modelo termina viendo negro.
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

## Consola del navegador

`soporte/sin-sensores.js` se carga antes que p5 en todas las páginas y evita que p5
registre las escuchas de `deviceorientation` y `devicemotion` (no se usan: el movimiento
viene de la cámara). Eso saca los avisos de Firefox:

```
El uso del sensor de orientación está obsoleto.
El uso del sensor de movimiento está obsoleto.
```

El error de **mapa de fuente** de ml5 no lo produce la página:

```
Error de mapa de fuente: Error: URL constructor: is not a valid URL.
... wasm:https://cdn.jsdelivr.net/npm/ml5@1.4.0/dist/ml5.min.js ... > WebAssembly.Module
```

Es el depurador de Firefox intentando resolver el mapa de un módulo WebAssembly que ml5
compila internamente al cargar. No hay URL que resolver y el depurador se queja; no afecta
la ejecución. Desaparece cerrando las herramientas de desarrollo o usando Chrome. Para
eliminarlo del todo habría que reemplazar ml5 por MediaPipe Pose Landmarker, que es lo que
propone `agent.md`.

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
- **Confianza de cintura hacia arriba**: la confianza de una persona se
  promedia solo sobre el tren superior. Promediar los 17 keypoints hacía que
  las piernas fuera de cuadro (confianza 0) hundieran el valor y nadie pudiera
  participar. Lo cubre `tests/verificar-pose.mjs`.
- **Inferencia lenta**: el bloqueo de participantes tolera hasta ~2,4 s entre
  detecciones, para máquinas sin GPU donde MoveNet corre a pocos cuadros por
  segundo.
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
