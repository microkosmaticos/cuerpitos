/* ------------------------------------------------------------------
   Sin sensores de dispositivo
   ------------------------------------------------------------------
   p5.js registra escuchas de `deviceorientation` y `devicemotion` al
   arrancar (para sus variables rotationX/Y/Z y accelerationX/Y/Z).
   Esta instalación no usa ninguno de los dos: el movimiento viene de
   la cámara.

   En Firefox, registrar esas escuchas hace que la consola avise:

     "El uso del sensor de orientación está obsoleto."
     "El uso del sensor de movimiento está obsoleto."

   Este script se carga ANTES de p5 y filtra esas dos escuchas durante
   el arranque, y también oculta los constructores para que la prueba
   de características de p5 no las registre. Después de un segundo
   devuelve todo a su estado normal, así ninguna otra librería queda
   afectada.

   Es un script clásico a propósito: tiene que ejecutarse antes que
   p5, sin esperar al módulo de la página.
   ------------------------------------------------------------------ */

(function () {
  "use strict";

  var SENSORES = {
    deviceorientation: true,
    deviceorientationabsolute: true,
    devicemotion: true,
  };

  var addEventListenerOriginal = window.addEventListener;
  var descriptorOrientacion = Object.getOwnPropertyDescriptor(
    window,
    "DeviceOrientationEvent"
  );
  var descriptorMovimiento = Object.getOwnPropertyDescriptor(
    window,
    "DeviceMotionEvent"
  );

  // 1. Se descartan las escuchas de sensores.
  window.addEventListener = function (tipo, ...resto) {
    if (SENSORES[String(tipo).toLowerCase()]) return;
    return addEventListenerOriginal.call(this, tipo, ...resto);
  };

  // 2. p5 solo registra si el constructor existe: se oculta un momento.
  const ocultar = (nombre, descriptor) => {
    try {
      Object.defineProperty(window, nombre, {
        value: undefined,
        configurable: true,
        writable: true,
      });
    } catch (error) {
      // Si el navegador no deja redefinirlo, el filtro de escuchas alcanza.
      void error;
      void descriptor;
    }
  };

  ocultar("DeviceOrientationEvent", descriptorOrientacion);
  ocultar("DeviceMotionEvent", descriptorMovimiento);

  // 3. Se restaura todo cuando p5 ya terminó de arrancar.
  window.setTimeout(function () {
    delete window.addEventListener;

    const restaurar = (nombre, descriptor) => {
      try {
        if (descriptor) Object.defineProperty(window, nombre, descriptor);
        else delete window[nombre];
      } catch (error) {
        void error;
      }
    };

    restaurar("DeviceOrientationEvent", descriptorOrientacion);
    restaurar("DeviceMotionEvent", descriptorMovimiento);
  }, 1000);
})();
