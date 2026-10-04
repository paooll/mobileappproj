import { useRef, useState } from "react";
import { ArrowClockwise, ImageSquare, Spinner, Trash } from "@phosphor-icons/react";
import PhotoBytes from "./PhotoBytes";
import { resizeForPost, type PostPhoto } from "../lib/avatar";

interface Props {
  /** The resized pair already chosen, or null when there is no picture. */
  photo: PostPhoto | null;
  onChange: (photo: PostPhoto | null) => void;
}

/**
 * Attaching a picture to the session about to be posted.
 *
 * Deliberate rather than automatic. A camera-roll prompt firing the moment a
 * workout ends interrupts the flow that finish is built to keep quiet, and the
 * rules cannot accept a photo after the post exists anyway, so the picture has
 * to be chosen here, before the post is written.
 *
 * The resize happens on this device, before anything is written: a thumbnail
 * rides inline on the post and a full image goes to its own document, and
 * Firestore caps a document at 1 MiB. Every rejection from that pipeline is
 * written to be acted on, so the message shown here is the one the pipeline
 * wrote rather than a generic failure.
 */
export default function PostPhotoPicker({ photo, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await resizeForPost(file));
    } catch (err) {
      console.error(err);
      // ResizeForPost writes every rejection to name its own cause, so this
      // says what happened and what to do rather than "could not upload".
      setError(err instanceof Error ? err.message : "Couldn't read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-7">
      <p className="label">Photo</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo for this session"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so picking the same file twice in a row still fires a
          // change event, which is what a retake after a mistake looks like.
          e.target.value = "";
          void pick(file);
        }}
      />

      {photo ? (
        <div className="panel mt-2 flex items-center gap-3 p-3">
          <span
            className="shrink-0 overflow-hidden rounded-[10px]"
            style={{ width: 64, height: 64, background: "var(--fill)" }}
          >
            <PhotoBytes
              bytes={photo.thumb}
              alt=""
              decorative
              className="h-full w-full object-cover"
            />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--ink-2)]">
            This goes on the post. The small copy rides in the feed, the full one
            loads when somebody opens it.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label="Choose a different photo"
              className="icon-btn text-[var(--ink-2)] disabled:opacity-60"
            >
              {busy ? (
                <Spinner size={17} />
              ) : (
                <ArrowClockwise size={17} />
              )}
            </button>
            <button
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              disabled={busy}
              aria-label="Remove the photo"
              className="icon-btn text-[var(--ink-2)] disabled:opacity-60"
            >
              <Trash size={17} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="tab mt-2 flex min-h-[44px] w-full items-center gap-2.5 rounded-xl bg-[var(--fill)] px-4 text-left disabled:opacity-60"
        >
          {busy ? (
            <Spinner size={19} className="shrink-0 text-[var(--ink-2)]" />
          ) : (
            <ImageSquare size={19} className="shrink-0 text-[var(--ink-2)]" />
          )}
          <span className="text-[15px] font-medium">
            {busy ? "Resizing…" : "Add a photo"}
          </span>
          <span className="label ml-auto shrink-0 normal-case">Optional</span>
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}