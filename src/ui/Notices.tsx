export interface NoticesProps {
  speechUnavailable: boolean;
  bellNoticeVisible: boolean;
}

export function Notices({ speechUnavailable, bellNoticeVisible }: NoticesProps) {
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
    </div>
  );
}
