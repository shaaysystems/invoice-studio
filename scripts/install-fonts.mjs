// Downloads the Inter static weights that @react-pdf/renderer embeds.
//
// These are NOT the web UI fonts — `app/layout.tsx` serves those through
// next/font. These exist so exported PDFs can render the rupee sign: Helvetica,
// the fallback, has no U+20B9 glyph and prints a broken box.
//
// Source is the @expo-google-fonts package, which republishes Google's static
// Inter TTFs one file per weight. The older jsDelivr path
// (`gh/rsms/inter@v4.0/docs/font-files/...`) 404s in every Inter release, which
// silently degraded every PDF to Helvetica.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const SOURCE = "https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3";

/** Destination name -> upstream file. Destinations must match pdf-document.tsx. */
const FILES = {
  "Inter-Regular.ttf": "Inter_400Regular.ttf",
  "Inter-Medium.ttf": "Inter_500Medium.ttf",
  "Inter-SemiBold.ttf": "Inter_600SemiBold.ttf",
  "Inter-Bold.ttf": "Inter_700Bold.ttf",
};

const DIR = path.join(process.cwd(), "public", "fonts");

/**
 * A CDN can answer 200 with an HTML error page. Writing that to a .ttf would
 * make fontkit throw at export time, so check the sfnt magic before writing.
 */
function isTrueType(buf) {
  if (buf.length < 4) return false;
  const tag = buf.subarray(0, 4).toString("latin1");
  return tag === "\0\0\0" || tag === "OTTO" || tag === "true" || tag === "ttcf";
}

await mkdir(DIR, { recursive: true });

let installed = 0;

for (const [dest, upstream] of Object.entries(FILES)) {
  const destPath = path.join(DIR, dest);
  try {
    await access(destPath);
    continue; // already present
  } catch {}

  try {
    const res = await fetch(`${SOURCE}/${upstream}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isTrueType(buf)) throw new Error(`not a TrueType file (${buf.length}b)`);
    await writeFile(destPath, buf);
    installed += 1;
    console.log(`[fonts] downloaded ${dest} (${Math.round(buf.length / 1024)}kB)`);
  } catch (err) {
    console.warn(`[fonts] skipped ${dest}: ${err.message} (PDF will fall back to Helvetica)`);
  }
}

if (installed > 0) console.log(`[fonts] installed ${installed} weight(s)`);
