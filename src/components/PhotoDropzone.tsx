"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2, ImageIcon } from "lucide-react";

export default function PhotoDropzone({
  label,
  onFileSelected,
  uploading,
}: {
  label: string;
  onFileSelected: (file: File) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFileSelected(file);
  }

  function clear() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted mb-2">{label}</p>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative rounded-xl border border-dashed border-line bg-panel-2 aspect-video flex items-center justify-center cursor-pointer overflow-hidden hover:border-accent transition"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted">
            <Camera size={20} />
            <span className="text-[11px]">Tap to capture / upload</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-white" />
          </div>
        )}
        {preview && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="absolute top-2 right-2 rounded-full p-1 bg-black/60 text-white"
          >
            <X size={13} />
          </button>
        )}
        {!preview && (
          <div className="absolute bottom-2 right-2 text-muted">
            <ImageIcon size={13} />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
