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

### Ronda 2 — arranque automático y cámara real (11/11)

Reporte del usuario: "no funciona nada, todo se debe iniciar automáticamente, quita
estas activaciones por teclas".

Cambios:
- Se quitaron las teclas F / D / H de la experiencia: el fondo es siempre la cámara, el
  HUD siempre visible y la depuración ya no se activa a mano (T4 revisado).
- **Bug real 1**: el `<video>` de la cámara estaba en `display:none`. Firefox deja de
  decodificar cuadros de un video oculto, así que el modelo veía negro y nunca detectaba a
  nadie. Ahora el video se muestra en el DOM detrás de un canvas transparente
  (`#camara-fondo` + `.lienzo-experiencia`); el canvas hace `clear()` y dibuja organismos y
  HUD encima.
- **Bug real 2**: `Pose` promediaba la confianza de los 17 keypoints. Con encuadre de
  cintura hacia arriba las piernas valen 0 y la persona no llegaba al mínimo de 0.6. Ahora
  promedia solo el tren superior, y acepta keypoints por nombre desde el array o como
  propiedades sueltas.
- **Bug real 3**: la memoria de candidatos era 700 ms. Si MoveNet tarda ~1 s por inferencia
  (CPU), el candidato se borraba antes de bloquearse. Ahora 2400 ms; `SIN_SENAL_MS` 2500 ms;
  `gracia` del ciclo 2 s.
- Arranque con 3 reintentos automáticos y límite de 45 s para la carga del modelo. El HUD
  muestra detecciones, confianza y candidatos para explicar por qué aún no hay organismo.
- Prueba nueva `tests/verificar-pose.mjs` (15 comprobaciones).

Verificado en Chrome headless con caché desactivada: video visible y decodificando
(`readyState 4`, `object-fit: cover`), canvas fijo transparente, y el camino REAL
(`ingestPoses` con poses crudas al estilo ml5, piernas en 0) hace nacer un organismo vivo
con confianza 0.88. Las siete páginas cargan sin errores.

### Ronda 3 — fondo artístico de enviroment.js (11/11)

Pedido: "no hagas que el fondo sea negro, respeta el fondo que ya te dije que era,
está en el archivo enviroment.js".

- La experiencia usa como fondo la composición de `enviroment.js`: capa base
  `fondo-cuerpitos-01.svg`, olas ondulando por franjas y estrellas con brillo propio.
- Se adaptó a modo instancia en `src/view/FondoArtistico.js` (misma matemática: cover
  sobre 2880 x 1800, mismas amplitudes, mismos períodos). `enviroment.js` queda intacto
  para `fondo.html`.
- La cámara ya no se muestra: solo detecta. El `<video>` sigue en el DOM (no
  `display:none`) para que Firefox decodifique, pero queda detrás del canvas opaco.
- La vista dejó de pintar fondo y velo: pinta el fondo artístico y después los
  organismos + HUD (con panel tenue para legibilidad sobre la obra).
- Verificado en Chrome headless sin caché: fondo animado completo, organismo vivo
  encima, HUD legible, siete páginas sin errores. `npm test` en verde.

### Ronda 4 — bodies.js como entrada de los avatares (11/11)

Pedido: "une bodies.js tiene los avatares, esos avatares responden al reconocimiento de
bodypose.js y después actúan según las especificaciones de reaccions.js".

- `bodies.js` estaba vacío (0 bytes). Ahora es el punto de entrada único del modelo de
  avatares: reexporta `OrganismManager`, `bornOrganism`, `crearVinculos`, `OrganismPose`,
  `ESTADOS`, límites y anclas de `src/model/**`, sin duplicar código, y documenta la cadena
  fondo → cuerpo → avatares → reacciones.
- `src/experiencia.js` y `ExperienciaController` ahora importan los avatares desde
  `bodies.js`, igual que ya importaban el cuerpo desde `bodypose.js` y las reacciones desde
  `reaccions.js`.
- Prueba nueva dentro de `verificar-experiencia.mjs`: el punto de entrada expone la API y
  `bornOrganism` devuelve id, forma y paleta.
- Verificado en Chrome headless con dos poses crudas inyectadas: dos avatares vivos,
  emociones distintas (`lovestruck`, `fainted`), relación `mutual_love` y eventos
  (`limb_stretch`, `faint`) sobre el fondo artístico, sin errores.

### Ronda 5 — el cuerpo sigue al cuerpo y las reacciones se ven (12/11)

Pedido: "los avatares solo cambian la escala; deberían responder a las reacciones y el
cuerpo del avatar debe configurarse y seguir los movimientos de bodypose".

Diagnóstico con la ruta real (poses crudas inyectadas, brazo moviéndose 130 px):
- `crearVinculos` **barajaba** las anclas: cada parte seguía un punto al azar del cuerpo.
- El estímulo era la proyección perpendicular a la dirección de reposo de la parte, así
  que una parte que apuntaba en vertical no respondía a un movimiento vertical: los
  ángulos medidos quedaban en 0–12° con un límite de 25°.
- La energía promediaba las 7 anclas: un gesto de un solo brazo se diluía.

Cambios:
- `crearVinculos` es anatómico: brazo → codo de su lado (2/3), antebrazo → muñeca (4/5),
  lado decidido por la geometría de la parte. El temperamento sigue siendo propio.
- `OrganismPose` mide el **giro del ancla alrededor del centro del cuerpo** (media lenta)
  en vez de la proyección perpendicular. Cualquier parte gira en el mismo sentido sin
  importar su orientación de reposo. Límites a 38° / curvatura 0.16 / escala 0.08.
- `TrackingAdapter` mezcla media y máximo de velocidad (50/50): un brazo alcanza.
- `efectos.js`: respuestas de evento más grandes (abrazo/beso se juntan, golpe retrocede,
  desmayo se hunde) y emociones más marcadas.
- `BehaviorBridge` marca `autonomousLimb` durante `limb_stretch`, como declara el catálogo.

Verificado en Chrome headless: energía 0.94 y ángulos de hasta ±32° siguiendo el brazo
(antes 0–12°); dos capturas con el brazo arriba/abajo muestran el avatar articulándose; y
un `hug` forzado mueve a los dos avatares hasta fusionarse. `npm test` en verde (175
comprobaciones de tracking, incluidas las nuevas del vínculo anatómico).

### Ronda 6 — el encuentro no espera al azar (12/11)

Pedido: "después que se confirmen las dos personas, se ejecute la reacción inmediatamente".

- `BehaviorEngine.provocar(eventId, actors, now)`: arranca un evento concreto respetando
  disponibilidad, emoción bloqueante y cantidad de participantes.
- `BehaviorBridge.provocarEncuentro(distancia)`: al haber dos organismos fija la relación
  (cerca → `mutual_love`, lejos → `conflict`), deja uno atraído y provoca `approach` en el
  acto. Se ejecuta antes del motor para que ninguna decisión aleatoria se adelante.
- `BehaviorBridge.intentarRemate()`: agenda la reacción del encuentro (`hug` con amor,
  `punch` con conflicto) y la ejecuta apenas la pareja queda libre, con límite de 8 s.
- El mensaje de carga dejó de ocupar el centro de la pantalla: va como línea del HUD. El
  panel central queda solo para un error final.
- Verificado en Chrome headless con dos poses inyectadas: el `approach` arranca en el mismo
  cuadro en que nace el segundo avatar (cuadro 54) y el abrazo llega a 60 % sin errores.
- `npm test`: 107 tests + 10 suites en verde (53 comprobaciones de comportamientos, con tres
  nuevas del encuentro).

### Ronda 7 — umbrales reales de MoveNet (12/11)

Pedido: "no se ejecuta ningún movimiento".

Se probó el camino REAL con ml5 sobre un video con personas (servidor con Range). Hallazgos
medidos:
- ml5 `bodyPose` devuelve `keypoints` con `confidence` y propiedades nombradas con
  `{x, y, confidence}`, pero **sin `score` a nivel de pose**: la confianza útil es el
  promedio del tren superior.
- Un torso real de frente promedia **0.41–0.47** de confianza. El umbral de nacimiento era
  **0.6** (y 0.5 por hombro): cuerpos válidos nunca llegaban a nacer.
- El adaptador exigía 0.18 unidades/s de velocidad para considerar movimiento, y la pose
  aplicaba otro piso: los gestos suaves quedaban invisibles.

Cambios:
- `CICLO.presencia`: confianza mínima 0.6 → 0.45; hombros 0.5 → 0.35.
- `TrackingAdapter`: zona muerta 0.03 → 0.012 y energía máxima 0.3 → 0.18.
- `OrganismPose`: zona muerta 0.05 → 0.02 y piso de respuesta 0.4 cuando hay gesto.
- `participants.js`: la compuerta de distancia del emparejamiento se ensancha con el hueco
  entre poses (inferencia lenta en CPU).
- HUD: muestra `anclas n/7 · energía e · video t s` para saber dónde se detiene la cadena.

`npm test` en verde (107 tests + 10 suites).
