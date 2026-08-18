import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const socialDirectory = join(root, "public/social");
const docsAssetDirectory = join(root, "docs/assets");
mkdirSync(socialDirectory, { recursive: true });
mkdirSync(docsAssetDirectory, { recursive: true });

function dataUri(relativePath: string, mimeType: string) {
  return `data:${mimeType};base64,${readFileSync(join(root, relativePath)).toString("base64")}`;
}

async function pngDataUri(relativePath: string) {
  const buffer = await sharp(join(root, relativePath)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

// librsvg does not reliably decode embedded WebP data URIs. Normalize the
// repository-owned WebP sources in memory so the generated SVG composites are
// deterministic across local and CI Sharp builds.
const parentLogo = await pngDataUri("src/static/logos/logo.webp");
const connectLogo = dataUri("src/static/logos/citiusconnect.png", "image/png");
const santorini = await pngDataUri("public/gallery/account/amalfi-santorini/santorini.webp");
const varanasi = await pngDataUri("public/gallery/spiritual/varanasi-sunset.webp");

const parentCard = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" x2="1">
      <stop offset="0" stop-color="#0b1026" stop-opacity="0.98"/>
      <stop offset="0.58" stop-color="#0b1026" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#0b1026" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <image href="${santorini}" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect x="72" y="70" width="358" height="126" rx="24" fill="#fffdf8"/>
  <image href="${parentLogo}" x="94" y="92" width="314" height="82" preserveAspectRatio="xMidYMid meet"/>
  <text x="74" y="330" fill="#ffffff" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="5">CITIUS HOLIDAYS</text>
  <text x="72" y="405" fill="#ffffff" font-family="Arial, sans-serif" font-size="56" font-weight="700">Journeys, thoughtfully arranged.</text>
  <text x="74" y="464" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="25">Leisure travel • MICE • Spiritual trails</text>
  <rect x="74" y="511" width="92" height="8" rx="4" fill="#f58220"/>
</svg>`;

const sacredCard = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="night" x1="0" x2="1">
      <stop offset="0" stop-color="#0b1026" stop-opacity="0.97"/>
      <stop offset="0.55" stop-color="#0b1026" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#0b1026" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <image href="${varanasi}" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="630" fill="url(#night)"/>
  <text x="76" y="170" fill="#f58220" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6">BY CITIUS HOLIDAYS</text>
  <text x="72" y="290" fill="#fff8e8" font-family="Georgia, serif" font-size="78" font-weight="700">Sacred Bharat</text>
  <text x="76" y="366" fill="#ffffff" font-family="Arial, sans-serif" font-size="34">Journeys rooted in place.</text>
  <text x="76" y="422" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="24">Trails • Check-ins • Thoughtful planning</text>
  <rect x="76" y="476" width="92" height="8" rx="4" fill="#f58220"/>
</svg>`;

await Promise.all([
  sharp(Buffer.from(parentCard))
    .jpeg({ mozjpeg: true, quality: 86 })
    .toFile(join(socialDirectory, "citius-holidays-social-card.jpg")),
  sharp(Buffer.from(sacredCard))
    .jpeg({ mozjpeg: true, quality: 86 })
    .toFile(join(socialDirectory, "sacred-bharat-social-card.jpg")),
]);

const board = `
<svg width="1600" height="1000" viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="1000" fill="#f7f3eb"/>
  <text x="64" y="68" fill="#0b1026" font-family="Arial, sans-serif" font-size="38" font-weight="700">Citius brand family</text>
  <text x="64" y="100" fill="#526075" font-family="Arial, sans-serif" font-size="18">Preservation-first review board • 2026-08-12 • Review-only</text>

  <g transform="translate(64 132)">
    <rect width="464" height="244" rx="28" fill="#ffffff" stroke="#d9dfe7"/>
    <image href="${parentLogo}" x="46" y="62" width="372" height="132" preserveAspectRatio="xMidYMid meet"/>
    <text x="32" y="220" fill="#102a83" font-family="Arial, sans-serif" font-size="17" font-weight="700">PARENT • CITIUS HOLIDAYS</text>
  </g>
  <g transform="translate(568 132)">
    <rect width="464" height="244" rx="28" fill="#0b1026"/>
    <text x="32" y="48" fill="#f58220" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="3">ONE FAMILY, DISTINCT JOBS</text>
    <text x="32" y="102" fill="#ffffff" font-family="Arial, sans-serif" font-size="25" font-weight="700">Citius Holidays</text>
    <text x="32" y="139" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="18">endorses Citius Connect</text>
    <text x="32" y="178" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="18">endorses Sacred Bharat</text>
    <text x="32" y="218" fill="#b5d43a" font-family="Arial, sans-serif" font-size="15">Never one flattened interface identity.</text>
  </g>
  <g transform="translate(1072 132)">
    <rect width="464" height="244" rx="28" fill="#102a83"/>
    <image href="${santorini}" width="464" height="164" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 28px 28px 0 0)"/>
    <rect y="142" width="464" height="102" fill="#102a83"/>
    <text x="28" y="190" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="700">Considered movement</text>
    <text x="28" y="218" fill="#dbeafe" font-family="Arial, sans-serif" font-size="16">Editorial travel • clear service action</text>
  </g>

  <g transform="translate(64 414)">
    <rect width="464" height="244" rx="28" fill="#eef2f7" stroke="#cbd5e1"/>
    <rect x="24" y="24" width="416" height="62" rx="16" fill="#ffffff"/>
    <image href="${connectLogo}" x="42" y="34" width="176" height="42" preserveAspectRatio="xMidYMid meet"/>
    <rect x="24" y="104" width="128" height="116" rx="16" fill="#ffffff"/>
    <rect x="168" y="104" width="272" height="34" rx="10" fill="#ffffff"/>
    <rect x="168" y="150" width="272" height="28" rx="8" fill="#dfe7f2"/>
    <rect x="168" y="190" width="190" height="28" rx="8" fill="#dfe7f2"/>
    <text x="40" y="137" fill="#102a83" font-family="Arial, sans-serif" font-size="15" font-weight="700">CALM</text>
    <text x="40" y="161" fill="#102a83" font-family="Arial, sans-serif" font-size="15" font-weight="700">OPERATIONS</text>
  </g>
  <g transform="translate(568 414)">
    <rect width="464" height="244" rx="28" fill="#0b1026"/>
    <image href="${varanasi}" width="464" height="244" preserveAspectRatio="xMidYMid slice" opacity="0.46"/>
    <rect width="464" height="244" rx="28" fill="#0b1026" opacity="0.46"/>
    <text x="30" y="88" fill="#f58220" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="3">BY CITIUS HOLIDAYS</text>
    <text x="28" y="142" fill="#fff8e8" font-family="Georgia, serif" font-size="38" font-weight="700">Sacred Bharat</text>
    <text x="30" y="180" fill="#ffffff" font-family="Arial, sans-serif" font-size="17">Text name • documentary place frame</text>
  </g>
  <g transform="translate(1072 414)">
    <rect width="464" height="244" rx="28" fill="#ffffff" stroke="#d9dfe7"/>
    <text x="28" y="45" fill="#0b1026" font-family="Arial, sans-serif" font-size="20" font-weight="700">Approved color roles</text>
    <circle cx="66" cy="104" r="30" fill="#0b1026"/><circle cx="146" cy="104" r="30" fill="#102a83"/>
    <circle cx="226" cy="104" r="30" fill="#f58220"/><circle cx="306" cy="104" r="30" fill="#8dc63f"/>
    <circle cx="386" cy="104" r="30" fill="#f7f3eb" stroke="#d9dfe7"/>
    <text x="28" y="178" fill="#0b1026" font-family="Arial, sans-serif" font-size="16">Navy anchors • paper breathes</text>
    <text x="28" y="207" fill="#526075" font-family="Arial, sans-serif" font-size="16">Orange/lime direct, never overwhelm</text>
  </g>

  <g transform="translate(64 696)">
    <rect width="464" height="240" rx="28" fill="#ffffff" stroke="#d9dfe7"/>
    <text x="30" y="52" fill="#0b1026" font-family="Arial, sans-serif" font-size="22" font-weight="700">Poppins</text>
    <text x="30" y="88" fill="#526075" font-family="Arial, sans-serif" font-size="16">Public headings • clear hierarchy</text>
    <text x="30" y="144" fill="#0b1026" font-family="Arial, sans-serif" font-size="22">Inter</text>
    <text x="30" y="180" fill="#526075" font-family="Arial, sans-serif" font-size="16">Body, controls, operational density</text>
  </g>
  <g transform="translate(568 696)">
    <rect width="464" height="240" rx="28" fill="#0b1026"/>
    <image href="${santorini}" x="18" y="18" width="206" height="150" preserveAspectRatio="xMidYMid slice"/>
    <rect x="240" y="18" width="206" height="150" fill="#102a83"/>
    <text x="258" y="78" fill="#ffffff" font-family="Arial, sans-serif" font-size="20" font-weight="700">DON'T</text>
    <text x="258" y="108" fill="#dbeafe" font-family="Arial, sans-serif" font-size="15">Let effects replace</text>
    <text x="258" y="132" fill="#dbeafe" font-family="Arial, sans-serif" font-size="15">evidence of place.</text>
    <text x="18" y="208" fill="#ffffff" font-family="Arial, sans-serif" font-size="16">DO • calm focal travel photography</text>
  </g>
  <g transform="translate(1072 696)">
    <rect width="464" height="240" rx="28" fill="#102a83"/>
    <text x="30" y="62" fill="#b5d43a" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="3">SYSTEM PROMISE</text>
    <text x="30" y="118" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">Care. Precision.</text>
    <text x="30" y="158" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">Purposeful journeys.</text>
    <text x="30" y="207" fill="#dbeafe" font-family="Arial, sans-serif" font-size="16">One family. Context-specific expression.</text>
  </g>
</svg>`;

await sharp(Buffer.from(board))
  .png({ compressionLevel: 9, palette: true })
  .toFile(join(docsAssetDirectory, "citius-brand-family-overview.png"));
