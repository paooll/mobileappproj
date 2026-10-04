import { useEffect, useState } from "react";

interface Props {
  /** Stored JPEG bytes, or null while there is none. */
  bytes: Uint8Array | null;
  alt: string;
  className?: string;
  /** Decorative by default: a thumbnail beside the session name is already named by it. */
  decorative?: boolean;
}

function objectUrlFor(bytes: Uint8Array): string {
  // Copy into a fresh buffer: Firestore hands back a view onto a larger
  // ArrayBuffer, and a Blob built from that would pin all of it.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy], { type: "image/jpeg" }));
}

/**
 * Renders image bytes that arrived from Firestore rather than from a URL.
 *
 * There is no bucket to serve from on the free plan, so every picture is held
 * as bytes and shown through an object URL. Each one pins its blob in memory
 * until it is revoked, so creating and releasing it has to be an effect.
 *
 * The URL is derived while rendering rather than stored by an effect, because
 * an effect that sets state on new bytes renders twice for every new picture.
 * React's own guidance for state that follows a prop is to adjust it during
 * render, which produces exactly one URL per set of bytes and exactly one
 * revocation, with nothing left behind by a discarded render.
 *
 * Whether the image is shown is derived rather than stored: a failed load is
 * remembered against the exact bytes it failed for, so new bytes get a clean
 * attempt with no resetting.
 *
 * A load failure renders nothing rather than a broken-image glyph, which is the
 * right answer for both callers: a feed row without its picture is still a
 * complete row, and a post sheet that already shows the thumbnail keeps showing
 * it.
 */
export default function PhotoBytes({ bytes, alt, className, decorative }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [urlFor, setUrlFor] = useState<Uint8Array | null>(null);
  const [failedBytes, setFailedBytes] = useState<Uint8Array | null>(null);

  if (bytes !== urlFor) {
    setUrlFor(bytes);
    setUrl(bytes ? objectUrlFor(bytes) : null);
  }

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (!bytes || !url || failedBytes === bytes) return null;

  return (
    <img
      src={url}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      // A feed carries up to 25 of these, so nothing is decoded until the row
      // it belongs to is actually scrolled to.
      loading="lazy"
      decoding="async"
      onError={() => setFailedBytes(bytes)}
      className={className}
    />
  );
}