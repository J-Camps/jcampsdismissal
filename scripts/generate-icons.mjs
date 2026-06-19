import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pub = join(root, "public");
const iconsDir = join(pub, "icons");

mkdirSync(iconsDir, { recursive: true });

const svgContent = readFileSync(join(pub, "favicon.svg"));

// Maskable icon SVG — same emblem but with extra padding and solid background
// (maskable icons need a "safe zone" — the inner 80% circle)
function makeMaskableSvg(size) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#F7F2EA"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="16" fill="#F7F2EA"/>
    <circle cx="40" cy="38" r="30" stroke="#023B64" stroke-width="1.5" fill="white"/>
    <rect x="37" y="18" width="11" height="28" rx="2" fill="#023B64"/>
    <path d="M37 41 Q37 53 25 53 Q18 53 16 48 L21 46 Q22 50 25 50 Q32 50 32 41 L32 18 L37 18 Z" fill="#023B64"/>
    <clipPath id="circ"><circle cx="40" cy="38" r="30"/></clipPath>
    <g clip-path="url(#circ)">
      <path d="M10 52 Q18 47 26 52 Q34 57 42 52 Q50 47 58 52 Q66 57 70 54 L70 70 L10 70 Z" fill="#005D4B" opacity="0.9"/>
    </g>
    <circle cx="50" cy="24" r="5.5" fill="#F2A900"/>
    <g stroke="#F2A900" stroke-width="1.5" stroke-linecap="round">
      <line x1="50" y1="14" x2="50" y2="11"/>
      <line x1="57" y1="17" x2="59" y2="15"/>
      <line x1="60" y1="24" x2="63" y2="24"/>
      <line x1="57" y1="31" x2="59" y2="33"/>
      <line x1="43" y1="17" x2="41" y2="15"/>
    </g>
  </svg>
</svg>`);
}

const tasks = [
  // Standard icons
  { input: svgContent, output: join(pub, "favicon-16x16.png"), size: 16 },
  { input: svgContent, output: join(pub, "favicon-32x32.png"), size: 32 },
  { input: svgContent, output: join(pub, "apple-touch-icon.png"), size: 180 },
  { input: svgContent, output: join(iconsDir, "icon-192.png"), size: 192 },
  { input: svgContent, output: join(iconsDir, "icon-512.png"), size: 512 },
  // Maskable icons (extra padding)
  { input: makeMaskableSvg(192), output: join(iconsDir, "maskable-icon-192.png"), size: 192 },
  { input: makeMaskableSvg(512), output: join(iconsDir, "maskable-icon-512.png"), size: 512 },
];

for (const t of tasks) {
  await sharp(t.input).resize(t.size, t.size).png().toFile(t.output);
  console.log(`  ✓ ${t.output.replace(root + "/", "")} (${t.size}x${t.size})`);
}

// Generate favicon.ico (32x32 PNG wrapped — browsers accept PNG-in-ICO)
const ico32 = await sharp(svgContent).resize(32, 32).png().toBuffer();
// ICO header for a single 32x32 PNG image
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0);    // reserved
icoHeader.writeUInt16LE(1, 2);    // type: icon
icoHeader.writeUInt16LE(1, 4);    // count: 1
icoHeader.writeUInt8(32, 6);      // width
icoHeader.writeUInt8(32, 7);      // height
icoHeader.writeUInt8(0, 8);       // palette
icoHeader.writeUInt8(0, 9);       // reserved
icoHeader.writeUInt16LE(1, 10);   // color planes
icoHeader.writeUInt16LE(32, 12);  // bits per pixel
icoHeader.writeUInt32LE(ico32.length, 14); // image size
icoHeader.writeUInt32LE(22, 18);  // offset to image data
const favicon = Buffer.concat([icoHeader, ico32]);
const { writeFileSync } = await import("fs");
writeFileSync(join(pub, "favicon.ico"), favicon);
console.log("  ✓ public/favicon.ico (32x32)");

console.log("\nDone! All icons generated.");
