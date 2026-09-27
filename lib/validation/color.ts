const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validateHexColor(value: string): boolean {
  return HEX_RE.test((value || "").trim());
}

/** Normalises `#abc` → `#aabbcc`, tolerates a missing `#`. Returns null if unusable. */
export function normalizeHexColor(value: string): string | null {
  let v = (value || "").trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return v.toLowerCase();
}
