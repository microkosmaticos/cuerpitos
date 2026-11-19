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
- Formas: un rectángulo entre hombro y codo, otro entre codo y muñeca, un rectángulo de tronco (chest), un círculo en cada hombro, uno en cada codo, uno en cada mano y un círculo en la cabeza. La mano es sólo un círculo en el extremo estirado del antebrazo: no se leen dedos. Los rectángulos tienen esquinas redondeadas (`CONFIG.figure.cornerRatio`) para mantener la misma familia visual que círculos y óvalos. El círculo del codo cubre la unión de los dos rectángulos del brazo, ya estirado por `armLength`. Sin caderas visibles, el tronco cuelga debajo de la línea de hombros.
- Cada figura sortea también su paleta: un color de cuerpo (`bone`) y uno de acento (`joint`), con matices separados 120–240°. El cuerpo tiene una luminancia mínima para que los ojos negros lean, y el acento se fuerza a ser claramente más luminoso que el cuerpo para que sombrero, flor, collar y contorno resalten (`CONFIG.figure.palette`). La paleta vive en `FigureProportions` y se conserva durante toda la sesión.
- Cada figura recibe al nacer un accesorio aleatorio (`CONFIG.figure.accessories`: `flower`, `hat` o `necklace`) que la acompaña durante toda su sesión: una flor de círculos en una esquina de la cabeza, un sombrero de dos rectángulos redondeados sobre la cabeza, o un collar de perlitas sobre el chest (un semicírculo de once círculos pequeños, con las puntas a la altura del chest y la perlita del medio cerrando el arco abajo). Sombrero y flor van siempre arriba y el collar abajo, sin importar el orden con que MoveNet etiquete ojos y hombros; la orientación se calcula con el eje como recta, no como vector. Usan la mitad de acento de la paleta (y el negro de los ojos en el centro de la flor) y las mismas formas que el cuerpo.
- Las reacciones son una librería de módulos independientes en `reactions/` (`punch.js`, `heart.js`), registradas en `reactions/library.js`. Un único director de escena (`reactions/director.js`, uno por vista) elige **una sola reacción al azar cada 10 s** y la ejecuta: nunca hay dos reacciones al mismo tiempo, y ninguna arranca sin los dos participantes en escena. La primera ventana se desfasa al azar para no disparar apenas se lockean las figuras. `punch` (~900 ms): el atacante pierde el control del brazo del lado del compañero y lo extiende en línea recta hacia su chest; al iniciar se congelan el lado, la dirección y el largo de los segmentos (el brazo real trackeado, con fallbacks proporcionales si los keypoints se pierden) y se aplica el `armLength` de la figura, con anticipación, estocada, overshoot y repliegue. `heart` (~2.8 s): aparece un corazón de acento grande en el punto medio entre los chests, se infla como un globo (pop elástico a 1.35 y asentado en 1.12, con un pequeño brillo), late suavemente y vuela hasta el borde superior real de la página (el view le pasa al director el top visible en coordenadas del video), donde se encoge hasta desaparecer. Mientras vuela emite una estela de partículas de corazones chicos: cada `spawnMs` nace una en la punta inferior del corazón principal, con vida corta, deriva lateral, caída leve, giro y achicado hasta desaparecer; todo se calcula desde el reloj, sin estado mutable. `cry` (~5.2 s): un participante al azar pierde el control de la cara y llora. Arranca con gotas: lágrimas grandes en forma de elipses verticales que caen con velocidad inicial más gravedad, derivan y se achican. A los 1.5 s la emisión cambia a un chorro continuo por cada ojo visible: una polilínea gruesa anclada en el ojo, con una onda viajera que se mueve mientras cae y con una fase distinta por ojo. El chorro mantiene su largo completo hasta que la reacción termina y entonces desaparece de golpe, sin recogerse. `smoke` (~6 s): un participante al azar se enoja y le salen bocanadas de humo de la parte superior de la cabeza. Mientras dura, los ojos se entrecierran (altura ×0.45) y se inclinan hacia adentro (±0.35 rad) para fruncir el ceño; la inclinación compensa el espejo del view para que las puntas internas siempre bajen en pantalla. Cada bocanada es una nube de 3 a 5 sub-bocanadas suaves superpuestas (`kind: "puff"`) que se funden en una silueta orgánica distinta y giran lentamente mientras suben. Cada sub-bocanada es un círculo con gradiente radial del color de acento, denso en el centro y transparente en el borde, con opacidad por forma que decae con la edad. Nacen en el borde superior de la cabeza, suben, derivan de costado y se hinchan y desvanecen; el renderer las dibuja con `createRadialGradient` (con fallback a círculos translúcidos) y descarta las que ya son invisibles. También es una reacción de cuerpo: el director se la asigna a un dueño por `slotId`, como el punch y el cry. El contorno es un path de Bézier que llega al fondo con tangente horizontal, así la punta queda redondeada y no en pico, manteniendo la tipología blanda de los personajes. El corazón es un prop de escena: se dibuja fuera del escalado de las figuras. Todo vive en `reactions/`, sin p5, y se prueba con `npm test`.
- El golpe impacta: el puño es un círculo y el torso del compañero tiene un hitbox circular alrededor del chest (`CONFIG.figure.impact.hitboxRadius`). Si se tocan, el que recibe pierde el control durante ~1.8 s (`ImpactState`): todo el cuerpo se desplaza con un knockback en la dirección del golpe, suma un vaivén mareado, los ojos ovalados ruedan y cuatro estrellitas de acento (`kind: "star"`) orbitan la cabeza. El knockback, el vaivén y las estrellas se aplican antes del escalado de `size`, así crecen con el cuerpo; recibir otro golpe mientras ya está mareado no reinicia la reacción. La forma `star` se dibuja en `skeleton-view.js`.
- Los ojos son dos óvalos negros verticales ubicados en los keypoints `left_eye` / `right_eye` y orientados según el eje entre ambos. Del tracking se lee **sólo la posición y el eje**: el tamaño sale del radio de la cabeza de la figura (`eyeWidth` / `eyeHeight`), así que la confianza y la separación de los keypoints no deforman el óvalo. Todo se escala con `size`.
- El único parpadeo es autónomo: cada figura cierra y abre los ojos cada `autoBlinkMs` (2 s por defecto), verticalmente. Si un ojo se pierde, conserva su última posición durante `forgetMs` y después desaparece. MoveNet no expone párpados, así que no hay parpadeo real que medir.
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