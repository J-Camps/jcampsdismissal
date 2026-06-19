import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pub = join(root, "public");
const iconsDir = join(pub, "icons");
mkdirSync(iconsDir, { recursive: true });

const source = join(pub, "emblem-source.png");

// Standard icons — just resize the source image to each target size
const sizes = [
  { size: 16, out: join(pub, "favicon-16x16.png") },
  { size: 32, out: join(pub, "favicon-32x32.png") },
  { size: 180, out: join(pub, "apple-touch-icon.png") },
  { size: 192, out: join(iconsDir, "icon-192.png") },
  { size: 512, out: join(iconsDir, "icon-512.png") },
];

for (const { size, out } of sizes) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`  ✓ ${out.replace(root + "/", "")} (${size}x${size})`);
}

// Maskable icons — need solid background so the safe zone works
for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 255 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile(join(iconsDir, `maskable-icon-${size}.png`));
  console.log(`  ✓ public/icons/maskable-icon-${size}.png (${size}x${size})`);
}

// favicon.ico
const ico32 = await sharp(source)
  .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
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
