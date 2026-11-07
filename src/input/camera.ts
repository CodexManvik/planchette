/**
 * Camera source for blink and nod detection using MediaPipe Face Landmarker.
 * Implements SignalSource interface for integration with the sweep logic.
 * Video is processed on-device and never uploaded.
 */

import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { SignalSource } from './keyboard.js';
import { createBlinkDetector, createNodDetector, createFaceWatch, BlinkDetector, NodDetector, FaceWatch } from './detectors.js';
import { WASM_BASE, MODEL_URL } from './mediapipe-config.js';

export type { SignalSource };
export type CameraMode = 'blink' | 'nod';

export interface CameraCallbacks {
  onSelect: () => void;
  onFaceLost?: () => void;
  onFaceFound?: () => void;
  onError?: (message: string) => void;
  onSample?: (sample: CameraSample) => void;
}

export interface CameraSample {
  t: number;
  left?: number;
  right?: number;
  noseY?: number;
}

interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

interface FaceLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

/**
 * Gets a human-readable error message from a getUserMedia error.
 */
function getUserMediaErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Camera permission was refused';
      case 'NotFoundError':
        return 'No camera was found';
      case 'NotReadableError':
        return 'Camera is already in use';
      case 'SecurityError':
        return 'Camera access requires HTTPS';
    }
  }
  return "Camera isn't available";
}

/**
 * Creates a camera signal source for blink or nod detection.
 * Video is processed on-device and never uploaded.
 */
export function createCameraSource(opts: {
  mode: CameraMode;
  onSelect: () => void;
  onFaceLost?: () => void;
  onFaceFound?: () => void;
  onError?: (message: string) => void;
  onSample?: (sample: CameraSample) => void;
}): SignalSource {
  // State
  let videoElement: HTMLVideoElement | null = null;
  let landmarker: FaceLandmarker | null = null;
  let detector: BlinkDetector | NodDetector | null = null;
  let faceWatch: FaceWatch | null = null;
  let frameLoopId: number | null = null;
  let recordingStartMs: number | null = null;
  let lastVideoTime: number = -1;
  let lastTimestamp: number = -1;
  let stopRequested = false;

  async function start(onSelect: () => void): Promise<void> {
    stopRequested = false;

    // Create own video element, hidden
    videoElement = document.createElement('video');
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);

    // Request camera stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      // Check if stop was requested while waiting for getUserMedia
      if (stopRequested) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (err) {
      const message = getUserMediaErrorMessage(err);
      opts.onError?.(message);
      // Clean up video element on error
      if (videoElement && videoElement.parentElement) {
        videoElement.parentElement.removeChild(videoElement);
      }
      return;
    }

    // Load MediaPipe dynamically
    try {
      const { FilesetResolver, FaceLandmarker: FL } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      landmarker = await FL.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1
      });
    } catch (err) {
      // Check if stop was requested while waiting for model to load
      if (stopRequested) {
        return;
      }
      opts.onError?.('Face detection model failed to load');
      stop();
      return;
    }

    // Check again after model loads
    if (stopRequested) {
      return;
    }

    // Create detectors
    detector = opts.mode === 'blink'
      ? createBlinkDetector({})
      : createNodDetector({});

    faceWatch = createFaceWatch({ lostAfterMs: 2000 });

    // Start frame loop
    recordingStartMs = performance.now();
    frameLoop();
  }

  function frameLoop(): void {
    if (stopRequested) return;

    frameLoopId = requestAnimationFrame(frameLoop);

    if (!videoElement || !landmarker || !detector || !faceWatch) {
      return;
    }

    // Skip if video is not ready
    if (videoElement.readyState < 2) {
      return;
    }

    // Skip if currentTime hasn't changed
    if (videoElement.currentTime === lastVideoTime) {
      return;
    }
    lastVideoTime = videoElement.currentTime;

    // Get current time
    let now = performance.now();

    // Ensure strictly increasing timestamp
    if (now <= lastTimestamp) {
      now = lastTimestamp + 1;
    }
    lastTimestamp = now;

    // Run face detection
    let result: FaceLandmarkerResult;
    try {
      result = landmarker.detectForVideo(videoElement, now);
    } catch (err) {
      opts.onError?.('Face detection failed');
      stop();
      return;
    }

    // Check face tracking
    const faceVisible = result.faceLandmarks && result.faceLandmarks.length > 0;
    const faceEvent = faceWatch.update(faceVisible, now);

    if (faceEvent === 'lost') {
      opts.onFaceLost?.();
    } else if (faceEvent === 'found') {
      opts.onFaceFound?.();
    }

    if (!faceVisible) {
      return;
    }

    // Extract blendshapes
    let leftScore = 0;
    let rightScore = 0;

    if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
      const blendshapes = result.faceBlendshapes[0];
      if (blendshapes.categories) {
        const leftBlink = blendshapes.categories.find((c: BlendshapeCategory) => c.categoryName === 'eyeBlinkLeft');
        const rightBlink = blendshapes.categories.find((c: BlendshapeCategory) => c.categoryName === 'eyeBlinkRight');
        leftScore = leftBlink?.score ?? 0;
        rightScore = rightBlink?.score ?? 0;
      }
    }

    // Extract landmarks for nod
    let noseY = 0;
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];
      if (landmarks.length > 1) {
        const noseLandmark = landmarks[1] as FaceLandmarkPoint;
        noseY = noseLandmark.y; // Nose tip is landmark 1
      }
    }

    // Record sample if connected
    if (opts.onSample && recordingStartMs !== null) {
      const t = now - recordingStartMs;
      if (opts.mode === 'blink') {
        opts.onSample({ t, left: leftScore, right: rightScore });
      } else {
        opts.onSample({ t, noseY });
      }
    }

    // Feed detector
    const fired = opts.mode === 'blink'
      ? (detector as BlinkDetector).update(leftScore, rightScore, now)
      : (detector as NodDetector).update(noseY, now);

    if (fired) {
      opts.onSelect();
    }
  }

  function stop(): void {
    stopRequested = true;

    if (frameLoopId !== null) {
      cancelAnimationFrame(frameLoopId);
      frameLoopId = null;
    }

    if (landmarker) {
      try {
        landmarker.close();
      } catch (err) {
        // Ignore close errors
      }
      landmarker = null;
    }

    if (videoElement) {
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
      // Remove video element from document
      if (videoElement.parentElement) {
        videoElement.parentElement.removeChild(videoElement);
      }
      videoElement = null;
    }
  }

  return { start, stop };
}
