import { cn } from "@/lib/utils";

interface SafeImageProps {
  src: string;
  /** Maximum bounding box in pt. Aspect ratio is always preserved. */
  maxWidth: number;
  maxHeight: number;
  alt: string;
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * Renders an uploaded image inside a bounding box using object-fit: contain.
 * Logos and signatures are never cropped or stretched.
 */
export function SafeImage({ src, maxWidth, maxHeight, alt, align = "left", className }: SafeImageProps) {
  if (!src) return null;
  return (
    <div
      className={cn(
        "flex",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className,
      )}
      style={{ maxWidth: `${maxWidth}pt`, height: `${maxHeight}pt` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        style={{
          maxWidth: `${maxWidth}pt`,
          maxHeight: `${maxHeight}pt`,
          width: "auto",
          height: "auto",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  inline?: boolean;
}

/** Renders nothing at all when the value is empty — no orphaned labels. */
export function FieldRow({ label, value, labelColor, valueColor, inline = true }: FieldRowProps) {
  if (!value || value.trim() === "") return null;
  return (
    <div
      style={{ display: "flex", gap: "4pt", alignItems: "baseline", flexDirection: inline ? "row" : "column" }}
    >
      <span style={{ color: labelColor, fontSize: "7.2pt", letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: valueColor, fontSize: "8.6pt", lineHeight: 1.35, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

export function TextLine({ value, color, size = 8.6, weight = 400, className }: {
  value: string;
  color: string;
  size?: number;
  weight?: number;
  className?: string;
}) {
  if (!value || value.trim() === "") return null;
  return (
    <div
      className={className}
      style={{ color, fontSize: `${size}pt`, fontWeight: weight, lineHeight: 1.38, wordBreak: "break-word" }}
    >
      {value}
    </div>
  );
}

export function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="tracked-label"
      style={{ color, fontSize: "7pt", fontWeight: 600, marginBottom: "5pt" }}
    >
      {children}
    </div>
  );
}
