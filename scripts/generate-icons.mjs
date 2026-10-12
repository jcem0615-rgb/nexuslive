#!/usr/bin/env node
/**
 * Renders every PWA / favicon / social asset from the SVG sources in public/.
 *
 *   npm run icons
 *
 * The SVGs are the originals — edit those, then re-run this. Generated PNGs
 * are committed so a clean checkout can build without needing sharp.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...parts) => resolve(root, 'public', ...parts);

/** Render at 4x the target so curves and the glow resample cleanly. */
const DENSITY = 384;

const targets = [
  { from: 'logo.svg', to: 'icons/icon-192.png', size: 192 },
  { from: 'logo.svg', to: 'icons/icon-256.png', size: 256 },
  { from: 'logo.svg', to: 'icons/icon-384.png', size: 384 },
  { from: 'logo.svg', to: 'icons/icon-512.png', size: 512 },
  { from: 'logo.svg', to: 'icons/apple-touch-icon.png', size: 180 },
  { from: 'logo.svg', to: 'icons/favicon-16.png', size: 16 },
  { from: 'logo.svg', to: 'icons/favicon-32.png', size: 32 },
  { from: 'logo.svg', to: 'icons/favicon-48.png', size: 48 },
  { from: 'icons/icon-maskable.svg', to: 'icons/icon-maskable-192.png', size: 192 },
  { from: 'icons/icon-maskable.svg', to: 'icons/icon-maskable-512.png', size: 512 },
];

/**
 * Pack PNGs into an .ico. The format allows a whole PNG as an entry, which
 * every browser since IE11 reads, so there is no BMP encoding to do here.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  await mkdir(pub('icons'), { recursive: true });

  for (const { from, to, size } of targets) {
    await sharp(pub(from), { density: DENSITY })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(pub(to));
    console.log(`  ${to.padEnd(34)} ${size}x${size}`);
  }

  // Social card.
  await sharp(pub('og.svg'), { density: 144 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(pub('og.png'));
  console.log(`  ${'og.png'.padEnd(34)} 1200x630`);

  // Multi-size favicon.ico for browsers that still ask for one.
  const icoSizes = [16, 32, 48];
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      data: await sharp(pub('logo.svg'), { density: DENSITY }).resize(size, size).png().toBuffer(),
    })),
  );
  await writeFile(pub('favicon.ico'), buildIco(icoImages));
  console.log(`  ${'favicon.ico'.padEnd(34)} ${icoSizes.join('/')}`);
}

main().then(
  () => console.log('\nicons generated'),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
