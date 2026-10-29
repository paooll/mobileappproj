import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShareNetwork, DownloadSimple, Copy } from "@phosphor-icons/react";
import { generateShareCardBlob, type ShareCardData } from "../lib/shareCard";
import { useToast } from "./Toast";

interface Props {
  data: ShareCardData;
  onClose: () => void;
}

export default function ShareCardModal({ data, onClose }: Props) {
  const { toast } = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    generateShareCardBlob(data)
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
      })
      .catch((err) => {
        console.error("Failed to generate share card:", err);
        toast("Could not generate share card.", "error");
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, toast]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], `${data.workoutName.replace(/\s+/g, "-")}-summary.png`, {
      type: "image/png",
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${data.workoutName} Summary`,
        });
        toast("Shared successfully!", "success");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast("Sharing cancelled or unavailable.", "error");
        }
      }
    } else {
      handleDownload();
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${data.workoutName.replace(/\s+/g, "-")}-summary.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("Saved to your downloads.", "success");
  };

  const handleCopy = async () => {
    if (!blob) return;
    try {
      if (navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        toast("Card copied to clipboard!", "success");
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="panel relative z-10 flex w-full max-w-sm flex-col items-center rounded-2xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          <div className="flex w-full items-center justify-between pb-3 border-b border-[var(--line)]">
            <h3 className="text-[17px] font-bold">Share Workout</h3>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--fill)]"
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {/* Card Preview */}
          <div className="my-4 flex w-full justify-center">
            {generating || !previewUrl ? (
              <div className="flex h-80 w-48 animate-pulse items-center justify-center rounded-xl bg-[var(--fill)] text-[13px] text-[var(--ink-3)] font-medium">
                Designing card…
              </div>
            ) : (
              <img
                src={previewUrl}
                alt="Workout Summary Card"
                className="h-80 w-auto rounded-xl shadow-lg ring-1 ring-white/10 object-contain"
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="grid w-full grid-cols-3 gap-2 mt-2">
            <button
              onClick={handleShare}
              disabled={generating || !blob}
              className="btn-solid flex min-h-[44px] items-center justify-center gap-1.5 px-2 text-[13px] font-semibold"
            >
              <ShareNetwork size={16} weight="bold" /> Share
            </button>
            <button
              onClick={handleDownload}
              disabled={generating || !blob}
              className="btn-line flex min-h-[44px] items-center justify-center gap-1.5 px-2 text-[13px] font-semibold"
            >
              <DownloadSimple size={16} weight="bold" /> Save
            </button>
            <button
              onClick={handleCopy}
              disabled={generating || !blob}
              className="btn-line flex min-h-[44px] items-center justify-center gap-1.5 px-2 text-[13px] font-semibold"
            >
              <Copy size={16} weight="bold" /> Copy
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
