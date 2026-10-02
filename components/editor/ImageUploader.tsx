"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { deleteAsset, uploadAsset } from "@/lib/storage/uploads";
import { ALLOWED_IMAGE_TYPES, ASSET_RULES, type AssetKind } from "@/lib/validation/file";
import { Alert, Button, Tooltip } from "@/components/ui";

interface Props {
  label: string;
  hint?: string;
  kind: AssetKind;
  /** Stored value is always a URL string — empty means "not set". */
  url: string;
  onChange: (url: string) => void;
  authenticated: boolean;
  shape?: "wide" | "signature" | "square";
}

export function ImageUploader({ label, hint, kind, url, onChange, authenticated, shape = "wide" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frame =
    shape === "signature" ? "h-14 w-40" : shape === "square" ? "size-28" : "h-16 w-40";
  // Mirrors ASSET_RULES so the file picker offers only what will be accepted.
  const accept = ASSET_RULES[kind].allowSvg ? ALLOWED_IMAGE_TYPES.join(",") : "image/png,image/jpeg,image/webp";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    const result = await uploadAsset(file, kind, { authenticated });
    setBusy(false);
    if (!result.ok || !result.url) {
      setError(result.error ?? "That file could not be used.");
      return;
    }
    onChange(result.url);
  }

  async function handleRemove() {
    const previous = url;
    onChange("");
    setError(null);
    await deleteAsset(previous);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-shell-700">{label}</span>
        <span className="text-[10px] text-shell-500">Optional</span>
        {hint ? (
          <Tooltip text={hint}>
            {/* Decorative: the tooltip span carries the same text and is already
                in the accessibility tree, so labelling the icon too would
                announce the hint twice and shadow nearby field labels. */}
            <span
              tabIndex={0}
              aria-hidden="true"
              className="grid size-3.5 cursor-help place-items-center rounded-full border border-shell-300 text-[8px] text-shell-500"
            >
              i
            </span>
          </Tooltip>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`${frame} grid shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-shell-200 bg-shell-50 p-1.5`}
        >
          {url ? (
            // object-contain guarantees no distortion or cropping.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-shell-300">No file</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            aria-label={`Upload ${label}`}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-3.5" aria-hidden />
            )}
            {url ? "Replace" : "Upload"}
          </Button>
          {url ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleRemove()}>
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!authenticated && url ? (
        <p className="text-[10px] text-shell-500">
          Stored in this browser only. Sign in to keep uploads across devices.
        </p>
      ) : null}
    </div>
  );
}
