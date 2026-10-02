import type { CSSProperties } from "react";
import {
  SOCIAL_ICON_PRESETS,
  SOCIAL_ICON_STROKE,
  SOCIAL_ICON_VIEWBOX,
  type SocialIconPreset,
  clickableSocials,
  socialIconShapes,
} from "@/lib/invoice/social-links";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { Invoice } from "@/types/invoice";

/**
 * The clickable social strip. It replaces the printed link line it used to sit
 * under, so each profile appears as an icon once and links to its own URL.
 *
 * Appears twice per page, at two deliberate scales: `inline` in the From block
 * and `footer` on the right of the footer rule.
 *
 * Mirrored by `PdfSocialLinks` in `lib/export/pdf-document.tsx`; both draw from
 * `socialIconShapes` and read the same presets, so a change to the glyphs or
 * the scale has to be made in `lib/invoice/social-links.ts`.
 */
export function SocialIconRow({
  socials,
  tokens,
  preset = "inline",
  align = "flex-start",
  style,
}: {
  socials: Invoice["business"]["socials"];
  tokens: InvoiceTokens;
  preset?: SocialIconPreset;
  align?: CSSProperties["justifyContent"];
  style?: CSSProperties;
}) {
  const links = clickableSocials(socials);
  if (!links.length) return null;

  const { size, box, margin } = SOCIAL_ICON_PRESETS[preset];

  return (
    <div
      data-social-row={preset}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align,
        gap: "1pt",
        marginTop: margin ? `${margin}pt` : undefined,
        ...style,
      }}
    >
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          title={`${link.label}: ${link.href}`}
          aria-label={`${link.label}: ${link.value}`}
          data-social-icon={link.key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: `${box}pt`,
            height: `${box}pt`,
            color: tokens.inkSubtle,
            textDecoration: "none",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox={SOCIAL_ICON_VIEWBOX}
            fill="none"
            stroke="currentColor"
            strokeWidth={SOCIAL_ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {socialIconShapes(link.key).map((shape, index) =>
              shape.kind === "circle" ? (
                <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
              ) : (
                <path key={index} d={shape.d} />
              ),
            )}
          </svg>
        </a>
      ))}
    </div>
  );
}
