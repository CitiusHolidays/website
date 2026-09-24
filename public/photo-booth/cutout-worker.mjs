import { FilesetResolver, ImageSegmenter } from "./vendor/mediapipe-1.0.1/vision_bundle.mjs";

let segmenter;
self.onmessage = async ({ data: { id, bitmap } }) => {
  try {
    if (!segmenter) {
      self.postMessage({ id, phase: "preparing" });
      const files = await FilesetResolver.forVisionTasks(
        new URL("./vendor/mediapipe-1.0.1/wasm", import.meta.url).href,
        true
      );
      segmenter = await ImageSegmenter.createFromOptions(files, {
        baseOptions: {
          delegate: "CPU",
          modelAssetPath: new URL("./vendor/selfie-multiclass-256-v1.tflite", import.meta.url).href,
        },
        canvas: new OffscreenCanvas(1, 1),
        outputCategoryMask: false,
        outputConfidenceMasks: true,
        runningMode: "IMAGE",
      });
      if (segmenter.getLabels()[0] !== "background") {
        throw new Error("Unexpected model labels.");
      }
    }
    self.postMessage({ id, phase: "processing" });
    segmenter.segment(bitmap, (result) => {
      const background = result.confidenceMasks?.[0];
      if (!background) {
        throw new Error("No segmentation mask.");
      }
      const values = background.getAsFloat32Array();
      const alpha = new Uint8ClampedArray(values.length);
      for (let i = 0; i < values.length; i += 1) {
        const confidence = Number.isFinite(values[i]) ? 1 - values[i] : 0;
        // Preserve fully confident original pixels; retain soft alpha at the boundary.
        alpha[i] = Math.max(0, Math.min(255, Math.round(((confidence - 0.1) / 0.8) * 255)));
      }
      self.postMessage({ alpha, height: background.height, id, width: background.width }, [
        alpha.buffer,
      ]);
    });
  } catch {
    segmenter?.close();
    segmenter = undefined;
    self.postMessage({
      error: "Cutout processing is unavailable. Retry or choose the whole-photo frame.",
      id,
    });
  } finally {
    bitmap.close();
  }
};
