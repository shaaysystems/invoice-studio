import type { SocialLinks } from "@/types/invoice";
import { filled, visibleSocialLinks, type SocialEntry } from "./presence";

/** Every glyph below is drawn in this 24-unit user space, then scaled to size. */
export const SOCIAL_ICON_VIEWBOX = "0 0 24 24";
/** Stroke weight in the 24-unit icon space, before scaling. */
export const SOCIAL_ICON_STROKE = 2;

/**
 * The two places the strip is printed, and the only place a size may come from.
 * Both renderers read a preset rather than passing raw numbers, so the preview
 * and the PDF cannot drift apart on scale or spacing.
 *
 * `box` is the hit target and the space each icon owns, and stays wider than
 * `size` so neighbouring glyphs never touch. `hitSlop` extends the clickable
 * area past `box` without changing the printed footprint.
 */
export const SOCIAL_ICON_PRESETS = {
  /** In the From block, tucked under the business contact lines. */
  inline: { size: 9.5, box: 15, hitSlop: 1.5, margin: 3 },
  /** In the footer, right-aligned under the rule. Deliberately about twice as big. */
  footer: { size: 17, box: 23, hitSlop: 3, margin: 0 },
} as const;

export type SocialIconPreset = keyof typeof SOCIAL_ICON_PRESETS;

/** Gap above the strip where it follows a line of contact text. */
export const SOCIAL_ROW_MARGIN = SOCIAL_ICON_PRESETS.inline.margin;
/**
 * Height the From-block strip adds to the parties block. Pagination needs this
 * before anything is painted, so it cannot be measured from the DOM.
 */
export const SOCIAL_ROW_HEIGHT = SOCIAL_ICON_PRESETS.inline.box + SOCIAL_ICON_PRESETS.inline.margin;
/** The footer row grows from a single line of text to a line this tall. */
export const SOCIAL_FOOTER_ROW_HEIGHT = SOCIAL_ICON_PRESETS.footer.box;
/** Height of the plain business-name row that the icon box shares or replaces. */
export const FOOTER_TEXT_ROW_HEIGHT = 9;

export type SocialIconShape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number };

const SOCIAL_ICONS: Record<keyof SocialLinks, SocialIconShape[]> = {
  website: [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "path", d: "M16 12a4 10 0 0 1-8 0 4 10 0 0 1 8 0" },
    { kind: "path", d: "M2 12h20" },
  ],
  instagram: [
    { kind: "path", d: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z" },
    { kind: "circle", cx: 12, cy: 12, r: 4 },
    { kind: "circle", cx: 17.5, cy: 6.5, r: 1.1 },
  ],
  linkedin: [
    { kind: "path", d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" },
    { kind: "path", d: "M2 9h4v12H2Z" },
    { kind: "circle", cx: 4, cy: 4, r: 2 },
  ],
  twitter: [
    { kind: "path", d: "M4.5 4.5 19.5 19.5" },
    { kind: "path", d: "M19.5 4.5 4.5 19.5" },
  ],
};

export function socialIconShapes(key: keyof SocialLinks): SocialIconShape[] {
  return SOCIAL_ICONS[key] ?? SOCIAL_ICONS.website;
}

/**
 * Users paste whatever is on their profile badge, so "instagram.com/Example",
 * "www.instagram.com/Example", "https://instagram.com/Example/" and "@Example"
 * all have to reduce to the same handle before a URL is assembled.
 */
function profilePath(value: string, hosts: string[]): string {
  let out = value.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  for (const host of hosts) {
    const lower = out.toLowerCase();
    if (lower === host) return "";
    if (lower.startsWith(`${host}/`)) {
      out = out.slice(host.length + 1);
      break;
    }
  }
  return out.replace(/^@/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns a stored social value into an absolute, clickable URL. A value that
 * already carries a scheme is passed through untouched so custom schemes
 * (mailto:, tel:) survive.
 */
export function socialHref(entry: SocialEntry): string {
  const raw = entry.value.trim();
  if (!raw) return "";
  if (HAS_SCHEME.test(raw)) return raw;

  switch (entry.key) {
    case "instagram": {
      const handle = profilePath(raw, ["instagram.com"]);
      return handle ? `https://instagram.com/${handle}` : "";
    }
    case "linkedin": {
      const path = profilePath(raw, ["linkedin.com"]);
      return path ? `https://linkedin.com/${path}` : "";
    }
    case "twitter": {
      const handle = profilePath(raw, ["x.com", "twitter.com"]);
      return handle ? `https://x.com/${handle}` : "";
    }
    default:
      return `https://${raw.replace(/^\/+/, "")}`;
  }
}

export interface ClickableSocial extends SocialEntry {
  href: string;
}

/** Social values that resolve to a real destination, in display order. */
export function clickableSocials(social: SocialLinks): ClickableSocial[] {
  return visibleSocialLinks(social)
    .map((entry) => ({ ...entry, href: socialHref(entry) }))
    .filter((entry) => filled(entry.href));
}