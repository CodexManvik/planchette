export interface NoticesProps {
  speechUnavailable: boolean;
  bellNoticeVisible: boolean;
  faceLost?: boolean;
  cameraError?: string | null;
}

export function Notices({ speechUnavailable, bellNoticeVisible, faceLost, cameraError }: NoticesProps) {
  return (
    <div class="notices">
      {speechUnavailable && (
        <div class="notice speech-unavailable">
          Speech isn't working. Messages will appear as text.
        </div>
      )}

      {bellNoticeVisible && (
        <div class="notice bell">
          Calling for help
        </div>
      )}

      {faceLost && (
        <div class="notice face-lost">
          I can't see your face. Move the camera or the patient into view.
        </div>
      )}

      {cameraError && (
        <div class="notice camera-error">
          Camera isn't available: {cameraError}. You can keep using the spacebar.
        </div>
      )}
    </div>
  );
}
