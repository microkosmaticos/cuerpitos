# Proyecto: Organismos digitales generativos

## 1. Concepto general
Cada persona llega al mundo digital siendo distinta, y su organismo se relaciona con el de otra de forma impredecible.

La instalación utiliza una cámara web para detectar hasta dos personas. A partir de sus movimientos aparecen organismos digitales abstractos, generativos y deformables. Cada organismo tiene una identidad visual propia y un comportamiento parcialmente autónomo.

## 2. Aparición y detección
- Se detectarán como máximo dos personas.
- La persona debe estar de frente a la cámara y bien ubicada para que aparezca su organismo.
- Se trabajará con el encuadre de cintura hacia arriba.
- No se volteará horizontalmente la imagen de la cámara.
- No se reconocerán rostros ni se dibujarán caras.
- Si una persona se retira, su organismo desaparecerá mediante una transición.
- Si vuelve a entrar, nacerá un organismo nuevo, con otra identidad generativa.

## 3. Apariencia de los organismos
- Serán abstractos, orgánicos y generativos.
- No tendrán que reproducir todas las partes del cuerpo humano.
- Su forma podrá inspirarse en siluetas, extremidades, masas, curvas y formas blandas.
- Cada organismo tendrá proporciones, deformaciones, texturas y una paleta de color propias.
- Se utilizarán algunas familias de formas y paletas coherentes, con variaciones aleatorias.
- No tendrán rostro ni cuello.
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
- La cámara web será el fondo inicial de la experiencia.
- Los organismos se dibujarán encima de la imagen de la cámara.
- Se podrá añadir una capa de color o transparencia para mejorar el contraste.
- El estilo visual será abstracto, orgánico, redondeado y luminoso, con gradientes, transparencias y texturas.
- Habrá música ambiental y efectos sonoros asociados a algunos acontecimientos.
- El sonido podrá silenciarse.

## 10. Tecnología propuesta
- JavaScript: lenguaje principal.
- Vite: entorno para ejecutar el proyecto en el navegador.
- p5.js: dibujo, animación y composición visual.
- MediaPipe Pose Landmarker: detección de posiciones corporales.
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