import { useEffect, useState } from "react";

interface Props {
  /** The stored photo bytes, or null while there is none. */
  bytes: Uint8Array | null;
  /** Fallback shown when there is no photo. */
  initials: string;
  size?: number;
  /** Describes the athlete for screen readers. */
  name: string;
}

/**
 * Profile photo with an initials fallback.
 *
 * The image is held in Firestore as bytes rather than served from a bucket, so
 * it is rendered through an object URL. Each one pins its blob in memory until
 * it is revoked, so creating and releasing it has to be an effect.
 *
 * Whether a photo should be shown is derived rather than stored: a failed load
 * is remembered against the exact bytes it failed for, so a new photo gets a
 * clean attempt without any resetting.
 */
export default function Avatar({ bytes, initials, size = 56, name }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failedBytes, setFailedBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!bytes) return;
    // Copy into a fresh buffer: Firestore hands back a view onto a larger
    // ArrayBuffer, and a Blob built from that would pin all of it.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const objectUrl = URL.createObjectURL(new Blob([copy], { type: "image/jpeg" }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes]);

  const photoUrl = bytes ? url : null;
  const showPhoto = photoUrl && failedBytes !== bytes;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--ink)",
        color: "var(--bg)",
        fontSize: Math.round(size * 0.36),
      }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setFailedBytes(bytes)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}