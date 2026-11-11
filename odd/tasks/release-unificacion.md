# Release 0.1.0 — unificación de todo el trabajo

Objetivo: una sola rama `release/0.1.0` con el juego integrado y probable en el navegador.
Branch: `release/0.1.0`. Entrega: work-unit commits en la rama. Runner: `npm test` (node test + scripts propios).
Estado: cerrada (lista para probar).

## Specs

S1. `release/0.1.0` integra las cuatro líneas de trabajo sin perder ninguna:
    `develop` (fondo artístico + reset CSS), `feature/bodies` (familias, paletas, genomas, ciclo de vida,
    pose, mock, páginas), `bodypose/develop` (cámara, pose real, bloqueo de participantes) y
    `feature/reaccions` (emociones, eventos, motor de comportamientos).

S2. La página principal (`index.html`) abre la cámara web, la usa como fondo y dibuja los organismos
    encima: "La cámara web será el fondo inicial de la experiencia. Los organismos se dibujarán encima
    de la imagen de la cámara." La imagen no se voltea horizontalmente: "No se volteará horizontalmente
    la imagen de la cámara."

S3. Se detectan como máximo dos personas. Cada organismo queda emparejado con una persona por un id
    estable. Si la persona se retira, el organismo "desaparecerá mediante una transición". Si vuelve a
    entrar, "nacerá un organismo nuevo, con otra identidad generativa."

S4. Los organismos responden al movimiento humano por el contrato de 7 anclas ya definido
    (`src/model/tracking/TrackingFrame.js`) llenado con el tracking real. "Cuando la persona esté
    quieta, su organismo también permanecerá quieto."

S5. El motor de comportamientos de `reaccions.js` se registra por organismo nacido/desaparecido y sus
    directivas se traducen a efectos visuales; la emoción y el comportamiento activo se ven en el HUD.
    Se respetan las duraciones del catálogo (1–2 s, 2–4 s, 3–6 s) y los tiempos de espera.

S6. La identidad visual de cada organismo se genera al nacer y no cambia: mismas familias, paletas y
    semilla que `feature/bodies`. Sin rostro dibujado: los ojos decorativos quedan desactivados
    ("No se reconocerán rostros ni se dibujarán caras").

S7. Se conservan las páginas de prototipo para poder probar cada pieza por separado:
    `formas.html` (visor de formas), `galeria.html`, `organismos.html`, `escenario.html` (mock del
    ciclo de vida) y `fondo.html` (fondo artístico animado de `develop`).

S8. `npm test` corre todo lo que ya existía más lo nuevo: participantes, reacciones, familias, paletas,
    ciclo, tracking, composición, genomas, seeded random, adaptador y controlador de la experiencia.

S9. Privacidad y sin espejo: la cámara se procesa en el navegador, no se graba ni se almacena, y no hay
    reconocimiento facial. El sonido queda fuera de esta versión y se documenta como pendiente.

## Tasks

- [x] T1 · S1, S8 — `reaccions.js` como módulo ES + test `.mjs` + scripts de `package.json`. inline
- [x] T2 · S4 — adaptador `Pose`/`ParticipantTracker` → contrato de tracking + tests. inline
- [x] T3 · S5 — puente de comportamientos (alta/baja de organismos, directivas → estado visual) + test. inline
- [x] T4 · S2, S3, S6 — controlador y vistas de la experiencia, entrada y `index.html` + páginas. inline
- [x] T5 · S7, S9 — README de uso, verificación final y documentación de pendientes. inline

## Log

L1 (pedido del usuario, verbatim):
"ahora estamos en la rama realese, quiero que unifiques todo el trabajo para hacer una prueba si vale, tomando en cuenta que el desarrollo del juego y como va a funcionar esta dentro de @agent.md"

- Merges realizados en `release/0.1.0` (que era igual a `develop`): `feature/bodies`, `bodypose/develop`,
  `feature/reaccions`. Conflictos resueltos: `agent.md` (se conserva el del release, idéntico al adjuntado
  por el usuario), `index.html` (se conserva el de `feature/bodies` para reescribirlo en T4), `.atl`
  (generado, se conserva el del release).
- Los tests existentes pasan salvo `reaccions.test.js`: `package.json` de `bodypose/develop` declara
  `"type": "module"` y el test usa `require`. Se resuelve en T1.
- Decisión: el tracking real es ml5 bodyPose / MoveNet MULTIPOSE (ya construido y probado en
  `bodypose/develop`), no MediaPipe Pose Landmarker. Cumple la función de la sección 10 de agent.md y
  evita reescribir el bloqueo de participantes; se documenta la diferencia en T5.
- Decisión: la experiencia principal usa la cámara como fondo. El fondo artístico de `develop` se
  conserva como `fondo.html` y como capa opcional conmutables con una tecla.
- Verificación base: `tests/verificar-*.mjs` OK, `tests/participants.test.js` OK, `reaccions.test.js`
  falla solo por el cambio de `package.json` (ver arriba).

### Verificación (11/11)

- `npm test`: 10 suites OK (participantes 28, reacciones 98, familias 824, paletas 27,
  genomas 50, composición 9, ciclo 51, tracking 111, adaptador 31, comportamientos 39,
  experiencia 23).
- Chrome headless con cámara falsa: la página abre, la cámara arranca (640x480), ml5 carga
  el modelo, no hay excepciones de JS. El WebGL no existe en headless, así que la detección
  corre en CPU a ~1 fps (en una máquina real con GPU no aplica).
- Prueba visual con el tracker falso manejado por CDP: dos organismos nacen, se ubican en el
  centro de su persona, adoptan familias y paletas distintas, reciben emociones del
  `SocialPacer` y ejecutan eventos (`euphoric_burst` al 77 %) sin errores.
- Fondo artístico conmutado con F: las tres capas se componen a pantalla completa.
- Páginas `formas`, `escenario`, `galeria`, `organismos`, `fondo` y `esqueleto`: las seis
  dibujan canvas y no lanzan errores.

### Pendientes detectados

- Sonido: no implementado (no hay assets).
- El modelo real es ml5 MoveNet; el seguimiento real no se pudo probar con una persona en
  cámara desde este entorno, solo con la cámara falsa (sin persona detectada). La primera
  prueba con una persona real es lo que falta validar en el navegador del usuario.
- El HUD muestra los fps de detección: en headless con CPU da 1; en la máquina real debería
  ser mucho mayor.
