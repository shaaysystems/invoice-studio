import { describe, expect, it } from "vitest";
import {
  SOCIAL_ICON_PRESETS,
  SOCIAL_ICON_VIEWBOX,
  SOCIAL_ROW_HEIGHT,
  clickableSocials,
  socialHref,
  socialIconShapes,
} from "@/lib/invoice/social-links";
import {
  SOCIAL_FOOTER_ROW_GROWTH,
  measureFooter,
  measurePartiesBlock,
} from "@/lib/invoice/layout-metrics";
import { createEmptyInvoice } from "@/lib/invoice/defaults";
import type { SocialLinks } from "@/types/invoice";

const empty: SocialLinks = { website: "", instagram: "", linkedin: "", twitter: "" };

function href(key: keyof SocialLinks, value: string): string {
  const entry = { key, label: key, value };
  return socialHref(entry);
}

describe("socialHref", () => {
  it("assumes https when a website is typed without a scheme", () => {
    expect(href("website", "example.com")).toBe("https://example.com");
    expect(href("website", "  www.example.com/studio  ")).toBe("https://www.example.com/studio");
    expect(href("website", "/example.com")).toBe("https://example.com");
  });

  it("passes through anything that already carries a scheme", () => {
    expect(href("website", "http://example.com")).toBe("http://example.com");
    expect(href("website", "https://example.com")).toBe("https://example.com");
    expect(href("instagram", "mailto:studio@example.com")).toBe("mailto:studio@example.com");
    expect(href("linkedin", "https://www.linkedin.com/in/example")).toBe(
      "https://www.linkedin.com/in/example",
    );
  });

  it("reduces every Instagram spelling to the same profile URL", () => {
    const expected = "https://instagram.com/example.studio";
    expect(href("instagram", "@example.studio")).toBe(expected);
    expect(href("instagram", "example.studio")).toBe(expected);
    expect(href("instagram", "instagram.com/example.studio")).toBe(expected);
    expect(href("instagram", "www.instagram.com/example.studio/")).toBe(expected);
    expect(href("instagram", "https://instagram.com/example.studio")).toBe(expected);
  });

  it("keeps the LinkedIn path the user typed", () => {
    expect(href("linkedin", "example-studio")).toBe("https://linkedin.com/example-studio");
    expect(href("linkedin", "linkedin.com/company/example-studio")).toBe(
      "https://linkedin.com/company/example-studio",
    );
    expect(href("linkedin", "linkedin.com/in/example")).toBe("https://linkedin.com/in/example");
  });

  it("moves X and Twitter handles onto x.com", () => {
    expect(href("twitter", "@example")).toBe("https://x.com/example");
    expect(href("twitter", "twitter.com/example")).toBe("https://x.com/example");
    expect(href("twitter", "https://x.com/example")).toBe("https://x.com/example");
  });

  it("drops a value that carries no destination", () => {
    expect(href("instagram", "instagram.com")).toBe("");
    expect(href("linkedin", "linkedin.com/")).toBe("");
    expect(href("twitter", "  ")).toBe("");
  });
});

describe("clickableSocials", () => {
  it("returns nothing when no profile is filled in", () => {
    expect(clickableSocials(empty)).toEqual([]);
  });

  it("keeps display order and skips entries with no usable link", () => {
    const socials: SocialLinks = {
      website: "example.com",
      instagram: "instagram.com",
      linkedin: "",
      twitter: "@example",
    };
    expect(clickableSocials(socials).map((link) => link.key)).toEqual(["website", "twitter"]);
  });
});

describe("socialIconShapes", () => {
  it("gives every supported network a glyph", () => {
    for (const key of Object.keys(empty) as (keyof SocialLinks)[]) {
      expect(socialIconShapes(key).length).toBeGreaterThan(0);
    }
  });

  it("draws inside the declared viewBox", () => {
    for (const key of Object.keys(empty) as (keyof SocialLinks)[]) {
      for (const shape of socialIconShapes(key)) {
        if (shape.kind === "circle") {
          expect(shape.cx - shape.r).toBeGreaterThanOrEqual(0);
          expect(shape.cy - shape.r).toBeGreaterThanOrEqual(0);
          expect(shape.cx + shape.r).toBeLessThanOrEqual(24);
          expect(shape.cy + shape.r).toBeLessThanOrEqual(24);
        } else {
          expect(shape.d).not.toContain("NaN");
        }
      }
    }
    expect(SOCIAL_ICON_VIEWBOX).toBe("0 0 24 24");
  });
});

describe("SOCIAL_ICON_PRESETS", () => {
  it("prints the footer copy at roughly twice the From-block copy", () => {
    const { inline, footer } = SOCIAL_ICON_PRESETS;
    expect(footer.size).toBeGreaterThanOrEqual(16);
    expect(footer.size).toBeLessThanOrEqual(17);
    expect(footer.size / inline.size).toBeGreaterThan(1.7);
  });

  it("keeps the hit target wider than the glyph in both places", () => {
    for (const preset of Object.values(SOCIAL_ICON_PRESETS)) {
      expect(preset.box).toBeGreaterThan(preset.size);
      expect(preset.hitSlop).toBeGreaterThan(0);
    }
  });
});

describe("measureFooter", () => {
  const footerFor = (socials: SocialLinks) => {
    const base = createEmptyInvoice();
    return measureFooter({ ...base, business: { ...base.business, socials } });
  };

  it("reserves the taller icon row only when a link will actually render", () => {
    const bare = footerFor(empty);
    const withLinks = footerFor({ ...empty, website: "example.com" });

    expect(withLinks - bare).toBe(SOCIAL_FOOTER_ROW_GROWTH);
    expect(withLinks).toBeGreaterThan(bare);
    expect(footerFor({ ...empty, instagram: "instagram.com" })).toBe(bare);
  });
});

describe("measurePartiesBlock", () => {
  /** The From column has to be the tallest one, or its height is masked by max(). */
  function withTallFromColumn(socials: SocialLinks) {
    const base = createEmptyInvoice();
    return measurePartiesBlock({
      ...base,
      business: {
        ...base.business,
        name: "Northstar Studio",
        email: "studio@example.com",
        phone: "+91 98200 00000",
        gstin: "27ABCDE1234F1Z5",
        pan: "ABCDE1234F",
        address: { ...base.business.address, line1: "12 Linking Road", city: "Mumbai", state: "MH", pincode: "400050" },
        socials,
      },
    });
  }

  it("reserves one fixed row for the icon strip, not a line per profile", () => {
    const bare = withTallFromColumn(empty);
    const one = withTallFromColumn({ ...empty, website: "example.com" });
    const three = withTallFromColumn({ ...empty, website: "example.com", instagram: "@s", twitter: "@t" });

    // The strip never wraps, so one profile and three cost the same.
    expect(one - bare).toBe(SOCIAL_ROW_HEIGHT);
    expect(three - bare).toBe(SOCIAL_ROW_HEIGHT);
  });

  it("reserves nothing for a value that cannot become a link", () => {
    expect(withTallFromColumn({ ...empty, instagram: "instagram.com" })).toBe(
      withTallFromColumn(empty),
    );
  });
});