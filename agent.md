# Proyecto: Organismos digitales generativos

## 1. Concepto general
Cada persona llega al mundo digital siendo distinta, y su organismo se relaciona con el de otra de forma impredecible.

La instalación utiliza una cámara web para detectar hasta dos personas. A partir de sus movimientos aparecen organismos digitales abstractos, generativos y deformables. Cada organismo tiene una identidad visual propia y un comportamiento parcialmente autónomo.

## 2. Aparición y detección
- Se detectarán como máximo dos personas. Si hay más, solo se siguen las dos de mayor confianza.
- La persona debe estar de frente a la cámara y bien ubicada para que aparezca su organismo.
- Se trabajará con el encuadre de cintura hacia arriba.
- La proyección visual será en espejo: el movimiento se refleja horizontalmente en pantalla, de modo que la mano derecha de la persona aparece a la derecha de quien mira, como frente a un espejo. Los datos de pose se mantienen en coordenadas reales; el espejo se aplica únicamente al dibujar.
- No se reconocerán rostros ni se dibujarán caras.
- Durante el desarrollo del módulo de tracking, la cámara no se muestra: solo se visualiza un esqueleto de seguimiento del tren superior (puntos, líneas, cuello y círculo de cabeza). Puede incluir puntos de ojos, nariz y orejas como referencia de posición; no es un rostro dibujado ni la estética final de los organismos.
- Sobre cada articulación se escribe su nombre de rig (`shoulder.L`, `elbow.R`, `wrist.L`, `chest`, `pelvis`, `head`, …) con la convención de Blender/Rigify (`.L` / `.R`), para construir y verificar el armature que después moverá a los organismos. La tabla de nombres y la jerarquía de huesos viven en `rig.js` y se validan con `npm test`.
- Si una persona se retira, su organismo desaparecerá mediante una transición.
- Si vuelve a entrar, nacerá un organismo nuevo, con otra identidad generativa.

### 2.1 Bloqueo de participantes (Participant Lock)

La detección y la selección son capas separadas. MoveNet puede ver más de dos personas; la experiencia solo incorpora a dos.

- **Selección**: se consideran candidatos dentro de una zona central del encuadre, con torso visible y confianza suficiente. El candidato debe mantenerse estable ~1,4 s antes de bloquearse.
- **Bloqueo**: una vez bloqueados, los dos participantes conservan un `participantId` y un `slotId` estables, independientes del ID efímero de MoveNet. Las personas del fondo no reemplazan a un participante aunque tengan mayor confianza.
- **Pérdida temporal**: si un participante deja de detectarse, su slot pasa a `LOST` hasta 2 s. Si reaparece en ese tiempo, recupera su identidad y su asociación con el organismo.
- **Ausencia prolongada**: superada la tolerancia, el slot queda `ABSENT` y reservado. No se asigna a otra persona.
- **Liberación**: la sesión se libera solo cuando ambos participantes estuvieron ausentes ~6 s. Recién entonces se puede seleccionar una pareja nueva.
- La lógica vive en `participants.js`, sin p5 ni ml5, y se prueba con `npm test`.

### 2.2 Figura geométrica generativa

- Al bloquearse un participante se genera su figura: un cuerpo geométrico que reemplaza en pantalla al esqueleto de seguimiento.
- Las proporciones se sortean una sola vez por participante y se conservan durante toda su sesión, también en `LOST`. Un participante nuevo es un cuerpo nuevo.
- `girth` varía el ancho del tronco, los brazos y los hombros (personajes gordos y flacos); `armLength` varía la longitud de los dos segmentos de cada brazo; `headSize` varía el radio de la cabeza; `size` escala el cuerpo entero alrededor del chest para que convivan personajes pequeños y grandes. Los rangos viven en `CONFIG.figure.proportions`.
- La figura sigue las articulaciones detectadas (hombro, codo, muñeca, cadera y centro de cabeza) y estira cada segmento de brazo según `armLength`, respetando la dirección del movimiento y manteniendo la cadena hombro→codo→muñeca conectada.
- Formas: un rectángulo entre hombro y codo, otro entre codo y muñeca, un rectángulo de tronco (chest), un círculo en cada hombro, uno en cada codo y un círculo en la cabeza. Los rectángulos tienen esquinas redondeadas (`CONFIG.figure.cornerRatio`) para mantener la misma familia visual que círculos y óvalos. El círculo del codo cubre la unión de los dos rectángulos del brazo, ya estirado por `armLength`. Sin caderas visibles, el tronco cuelga debajo de la línea de hombros.
- Los ojos son dos óvalos negros verticales en los keypoints `left_eye` / `right_eye`, orientados según el eje entre ambos ojos y dimensionados a partir de la separación real entre ellos. Con un solo ojo visible se dibuja igual, usando el radio de la cabeza como referencia. Todo se escala con `size`, junto con el resto del cuerpo.
- El parpadeo sigue el tiempo real: el párpado se cierra mientras falta el keypoint del ojo y se reabre apenas vuelve, en la última posición conocida. El cierre es rápido y la reapertura también (`closeTime` / `openTime`); un parpadeo más corto que `minBlinkMs` se mantiene cerrado ese mínimo para que se lea. Si se pierde un solo ojo, sólo se cierra ese ojo. El entrecerrado sigue la confianza del keypoint. MoveNet no expone párpados, así que es una inferencia y no una medición: para parpadeo real haría falta un modelo de landmarks faciales.
- El esqueleto de seguimiento queda disponible como capa de depuración con `CONFIG.figure.showSkeleton`.
- La geometría vive en `figure.js`, sin p5, y se prueba con `npm test`; `skeleton-view.js` solo la dibuja.

## 3. Apariencia de los organismos
- Serán abstractos, orgánicos y generativos.
- No tendrán que reproducir todas las partes del cuerpo humano.
- Su forma podrá inspirarse en siluetas, extremidades, masas, curvas y formas blandas.
- Cada organismo tendrá proporciones, deformaciones, texturas y una paleta de color propias.
- Se utilizarán algunas familias de formas y paletas coherentes, con variaciones aleatorias.
- No tendrán rostro ni cuello. (Esto aplica a los organismos; el esqueleto de seguimiento es solo una herramienta de verificación.)
- Su identidad visual se generará al nacer y se conservará durante toda su aparición.

## 4. Identidad y transformación
- La anatomía y apariencia de un organismo no cambiarán durante su sesión.
- La generación aleatoria sucederá únicamente cuando nazca un organismo nuevo.
- No habrá gestos para regenerar o cambiar de cuerpo.
- Cada organismo conservará su identidad hasta desaparecer.

## 5. Movimiento
- Los organismos responderán a los movimientos de las personas.
- El movimiento humano será la base de su comportamiento, pero no determinará cada movimiento de manera literal.
- Tendrán movimientos autónomos ocasionales e impredecibles.
- Una parte del organismo, como un brazo o una extensión, podrá separarse temporalmente del seguimiento humano para ejecutar una acción autónoma y después regresar a su movimiento habitual.
- Cuando la persona esté quieta, su organismo también permanecerá quieto, salvo cuando ocurra un comportamiento autónomo.

## 6. Comportamientos individuales
Cuando haya una sola persona, su organismo aparecerá y podrá tener comportamientos propios, sin necesitar la presencia de otro organismo.

Podrá experimentar estados como timidez, euforia, mareo, atracción o desvanecimiento.

## 7. Interacciones entre organismos
Cuando haya dos personas, sus organismos podrán relacionarse mediante acontecimientos impredecibles.

Se contemplan acciones como acercarse, abrazarse, besarse, golpearse, rechazarse, atraerse, separarse o fusionarse temporalmente.

Cada organismo podrá tener un estado individual distinto al del otro. Por ejemplo, uno puede estar tímido mientras el otro está eufórico.

Las interacciones tendrán reglas de compatibilidad para evitar acciones contradictorias simultáneas. La aleatoriedad estará equilibrada con reglas, probabilidades y tiempos de espera.

## 8. Duración y ritmo
- Los acontecimientos serán breves.
- Las acciones pequeñas durarán aproximadamente 1–2 segundos.
- Los comportamientos individuales podrán durar 2–4 segundos.
- Las interacciones compartidas podrán durar 3–6 segundos.
- Los acontecimientos especiales no deberían superar aproximadamente 10 segundos.
- Habrá pausas para evitar que los comportamientos se repitan constantemente.

## 9. Entorno visual y sonido
- La cámara web será el fondo inicial de la experiencia (se incorpora en la etapa de entorno visual; en la etapa de tracking la cámara permanece oculta y solo se dibuja el esqueleto).
- El fondo de la instalación (`fondo-cuerpitos-01.svg`, `fondo-ondas.png`, `fondo-estrellas.png`, compuesto por `enviroment.js`) se dibuja como fondo del mismo canvas del sketch, debajo de las figuras.
- Los organismos se dibujarán encima de la imagen de la cámara.
- El fondo de cámara, cuando se incorpore, seguirá el mismo criterio de espejo que el esqueleto, para que la experiencia sea coherente.
- Se podrá añadir una capa de color o transparencia para mejorar el contraste.
- El estilo visual será abstracto, orgánico, redondeado y luminoso, con gradientes, transparencias y texturas.
- Habrá música ambiental y efectos sonoros asociados a algunos acontecimientos.
- El sonido podrá silenciarse.

## 10. Tecnología propuesta
- JavaScript: lenguaje principal, sin build step (ES Modules).
- p5.js: dibujo, animación y composición visual.
- ml5.js (bodyPose) para estimación de pose: modelo MoveNet MULTIPOSE para detectar hasta dos personas con seguimiento por ID. La alternativa BlazePose de ml5 corre sobre MediaPipe.
- Web Audio API o p5.sound: sonido.

## 11. Privacidad
La cámara se utilizará para procesar los movimientos en el navegador. La primera versión no grabará ni almacenará videos y no utilizará reconocimiento facial.

## 12. Objetivo de la primera versión
Construir progresivamente una experiencia que:
1. Abra la cámara web.
2. Detecte una persona y después hasta dos.
3. Haga aparecer un organismo abstracto por persona.
4. Permita que los organismos respondan al movimiento.
5. Genere comportamientos individuales e interacciones aleatorias.
6. Integre sonido y una presentación visual cuidada.