import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pub = join(root, "public");
const iconsDir = join(pub, "icons");

mkdirSync(iconsDir, { recursive: true });

const source = join(pub, "emblem-cropped.png");

async function makeIcon(size, output, { padding = 0.1, background = "#F7F2EA", round = 0 } = {}) {
  const pad = Math.round(size * padding);
  const inner = size - pad * 2;
  const buf = await sharp(source)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  let img = sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: buf, left: pad, top: pad }])
    .png();

  await img.toFile(output);
  console.log(`  ✓ ${output.replace(root + "/", "")} (${size}x${size})`);
}

// Favicons — tighter padding, transparent background for SVG-like feel
await makeIcon(16, join(pub, "favicon-16x16.png"), { padding: 0.06, background: { r: 0, g: 0, b: 0, alpha: 0 } });
await makeIcon(32, join(pub, "favicon-32x32.png"), { padding: 0.06, background: { r: 0, g: 0, b: 0, alpha: 0 } });

// Apple touch icon — cream background, some padding
await makeIcon(180, join(pub, "apple-touch-icon.png"), { padding: 0.1 });

// Standard app icons — cream background
await makeIcon(192, join(iconsDir, "icon-192.png"), { padding: 0.1 });
await makeIcon(512, join(iconsDir, "icon-512.png"), { padding: 0.1 });

// Maskable icons — more padding (safe zone is inner 80%)
await makeIcon(192, join(iconsDir, "maskable-icon-192.png"), { padding: 0.15 });
await makeIcon(512, join(iconsDir, "maskable-icon-512.png"), { padding: 0.15 });

// Generate favicon.ico (32x32 PNG-in-ICO)
const ico32 = await sharp(source)
  .resize(30, 30, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt8(32, 6);
icoHeader.writeUInt8(32, 7);
icoHeader.writeUInt8(0, 8);
icoHeader.writeUInt8(0, 9);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(ico32.length, 14);
icoHeader.writeUInt32LE(22, 18);
writeFileSync(join(pub, "favicon.ico"), Buffer.concat([icoHeader, ico32]));
console.log("  ✓ public/favicon.ico (32x32)");

console.log("\nDone!");
