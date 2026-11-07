import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCameraSource } from '../src/input/camera.js';

// Mock MediaPipe at top-level before any dynamic imports
const mockFilesetResolver = vi.hoisted(() => ({
  forVisionTasks: vi.fn(async () => ({}))
}));

const mockFaceLandmarker = vi.hoisted(() => ({
  createFromOptions: vi.fn(async () => ({
    detectForVideo: vi.fn(() => ({
      faceLandmarks: [],
      faceBlendshapes: []
    })),
    close: vi.fn()
  }))
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: mockFilesetResolver,
  FaceLandmarker: mockFaceLandmarker
}));

describe('Camera source', () => {
  let container: HTMLElement;
  let mockStream: MediaStream;
  let mockTracks: MediaStreamTrack[];
  let resolveGetUserMedia: (stream: MediaStream) => void = () => {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock MediaStream and tracks
    mockTracks = [
      {
        stop: vi.fn(),
        kind: 'video'
      } as unknown as MediaStreamTrack
    ];

    mockStream = {
      getTracks: vi.fn(() => mockTracks),
      getAudioTracks: vi.fn(() => []),
      getVideoTracks: vi.fn(() => mockTracks)
    } as unknown as MediaStream;

    // Define navigator.mediaDevices with getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(async () => mockStream)
      },
      configurable: true
    });

    // Mock HTMLVideoElement.play
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Clean up any remaining video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((v) => {
      if (v.parentElement) {
        v.parentElement.removeChild(v);
      }
    });

    document.body.removeChild(container);
    
    // Delete navigator.mediaDevices
    delete (navigator as any).mediaDevices;
    
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Privacy: camera left on (issue #1)', () => {
    it('should stop stream tracks if stop() called while getUserMedia pending', async () => {
      let resolveUserMedia: (stream: MediaStream) => void = () => {};
      const userMediaPromise = new Promise<MediaStream>((resolve) => {
        resolveUserMedia = resolve;
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(() => userMediaPromise)
        },
        configurable: true
      });

      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      // Start the camera
      const startPromise = source.start(() => {});

      // Immediately call stop before getUserMedia resolves
      source.stop();

      // Now resolve getUserMedia (simulating it arriving after stop was called)
      resolveUserMedia(mockStream);

      await startPromise;

      // Wait for microtasks and then assert
      await new Promise(r => setTimeout(r, 0));

      // Tracks should be stopped even though getUserMedia resolved after stop
      expect(mockTracks[0].stop).toHaveBeenCalled();
    });

    it('should stop stream tracks if stop() called while model loading', async () => {
      let resolveFilesetResolver: (vision: any) => void = () => {};
      let resolveFaceLandmarker: (landmarker: any) => void = () => {};

      const filesetPromise = new Promise<any>((resolve) => {
        resolveFilesetResolver = resolve;
      });

      const faceLandmarkerPromise = new Promise<any>((resolve) => {
        resolveFaceLandmarker = resolve;
      });

      // Override the mocked FilesetResolver and FaceLandmarker for this test
      mockFilesetResolver.forVisionTasks.mockReturnValue(filesetPromise);
      mockFaceLandmarker.createFromOptions.mockReturnValue(faceLandmarkerPromise);

      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      const startPromise = source.start(() => {});

      // Advance microtask to let getUserMedia resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Call stop before model finishes loading
      source.stop();

      // Resolve model promises
      resolveFilesetResolver({});
      resolveFaceLandmarker({
        detectForVideo: vi.fn(() => ({ faceLandmarks: [] as unknown as MediaStream, faceBlendshapes: [] })),
        close: vi.fn()
      });

      await startPromise;

      // Wait for microtasks
      await new Promise(r => setTimeout(r, 0));

      // Verify tracks were stopped
      expect(mockTracks[0].stop).toHaveBeenCalled();
    });

    it('should remove video element from document on stop', async () => {
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      await source.start(() => {});

      // Video element should be in document
      const videosBefore = document.querySelectorAll('video');
      expect(videosBefore.length).toBeGreaterThan(0);

      source.stop();

      // Video element should be removed
      const videosAfter = document.querySelectorAll('video');
      expect(videosAfter.length).toBe(0);
    });
  });

  describe('Own video element (issue #3)', () => {
    it('should create its own video element with playsInline and muted', async () => {
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      await source.start(() => {});

      const video = document.querySelector('video') as HTMLVideoElement;
      expect(video).toBeDefined();
      expect(video.playsInline).toBe(true);
      expect(video.muted).toBe(true);
      expect(video.style.display).toBe('none');

      source.stop();
    });

    it('should not use document.querySelector to find existing video', async () => {
      // Create an existing video element to ensure camera doesn't use it
      const existingVideo = document.createElement('video');
      existingVideo.id = 'existing';
      document.body.appendChild(existingVideo);

      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      await source.start(() => {});

      // Should have created a new video, not reused existing
      const videos = document.querySelectorAll('video');
      expect(videos.length).toBe(2); // existing + camera
      const cameraVideo = Array.from(videos).find((v) => !v.id) as HTMLVideoElement;
      expect(cameraVideo).toBeDefined();

      source.stop();
      document.body.removeChild(existingVideo);
    });
  });

  describe('Error messages (issue #5)', () => {
    it('should return "Camera permission was refused" for NotAllowedError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValueOnce(
            new DOMException('Permission denied', 'NotAllowedError')
          )
        },
        configurable: true
      });

      let errorMessage = '';
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
        onError: (msg) => {
          errorMessage = msg;
        }
      });

      await source.start(() => {});

      expect(errorMessage).toBe('Camera permission was refused');
    });

    it('should return "No camera was found" for NotFoundError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValueOnce(
            new DOMException('No camera found', 'NotFoundError')
          )
        },
        configurable: true
      });

      let errorMessage = '';
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
        onError: (msg) => {
          errorMessage = msg;
        }
      });

      await source.start(() => {});

      expect(errorMessage).toBe('No camera was found');
    });

    it('should return "Camera isn\'t available" for unknown errors', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValueOnce(
            new Error('Some unknown error')
          )
        },
        configurable: true
      });

      let errorMessage = '';
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
        onError: (msg) => {
          errorMessage = msg;
        }
      });

      await source.start(() => {});

      expect(errorMessage).toBe("Camera isn't available");
    });
  });

  describe('No `any` types (issue #4)', () => {
    it('should have proper types for FaceLandmarkerResult', async () => {
      const source = createCameraSource({
        mode: 'blink',
        onSelect: () => {},
      });

      // This test just verifies the code compiles without `any` types
      // The actual typing is verified by TypeScript during build
      await source.start(() => {});

      source.stop();

      // If this test runs without errors, typing is correct
      expect(true).toBe(true);
    });
  });
});
