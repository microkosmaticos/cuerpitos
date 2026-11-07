import { AppController } from "./controller.js";

/**
 * Composition root.
 *
 * Builds the app once and starts it. Reading this file top to bottom should
 * explain how the pieces fit together.
 */
const container = document.getElementById("app");
const hud = document.getElementById("hud");

const app = new AppController({ container, hud });
app.start();

// Handy while iterating in the browser console.
window.cuerpitos = app;
