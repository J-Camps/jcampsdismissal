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
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const svg = readFileSync(join(pub, "favicon.svg"), "utf8");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#F7F2EA"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 100 100">
    ${svg.replace(/<svg[^>]*>/, "").replace("</svg>", "")}
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
