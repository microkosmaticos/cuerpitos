import { CONFIG } from "./config.js";

/**
 * Camera as a pure source of pixels.
 *
 * It owns the webcam stream and a hidden <video> element. It knows nothing
 * about pose detection or drawing, so the camera can be swapped or mocked
 * without touching the rest of the app.
 */
export class CameraModel {
  constructor() {
    this.video = null;
    this.stream = null;
    this.width = 0;
    this.height = 0;
    this.ready = false;
  }

  async start() {
    if (this.ready) return this.video;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "getUserMedia no está disponible. Abrí la página por http://localhost, no con file://"
      );
    }

    const { width, height, facingMode } = CONFIG.camera;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: width },
        height: { ideal: height },
        facingMode,
      },
      audio: false,
    });

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    // Hidden but alive: the element keeps decoding frames for the model even
    // though nothing is painted on screen.
    video.style.display = "none";
    video.srcObject = this.stream;
    document.body.appendChild(video);

    await this.waitForMetadata(video);
    await video.play();

    // ml5 rescales keypoints to video.width / video.height. Matching the
    // element to the native stream size keeps coordinates in real pixels.
    video.width = video.videoWidth;
    video.height = video.videoHeight;

    this.video = video;
    this.width = video.videoWidth;
    this.height = video.videoHeight;
    this.ready = true;

    return video;
  }

  waitForMetadata(video) {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("No se pudo iniciar el video de la cámara"));
      };

      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    this.ready = false;
  }
}
