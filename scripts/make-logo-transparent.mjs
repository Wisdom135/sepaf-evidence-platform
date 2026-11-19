import fs from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "assets/sepaf-official-logo.png");
const outputPath = path.join(root, "assets/sepaf-official-logo-transparent.png");
const png = fs.readFileSync(inputPath);

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);

  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 8 + data.length)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return chunk;
}

let width;
let height;
const compressed = [];
for (let offset = 8; offset < png.length;) {
  const length = png.readUInt32BE(offset);
  const type = png.toString("ascii", offset + 4, offset + 8);
  const data = png.subarray(offset + 8, offset + 8 + length);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) {
      throw new Error("Expected a non-interlaced 8-bit RGB PNG logo.");
    }
  } else if (type === "IDAT") {
    compressed.push(data);
  } else if (type === "IEND") {
    break;
  }
  offset += length + 12;
}

const rgb = inflateSync(Buffer.concat(compressed));
const bytesPerPixel = 3;
const rowBytes = width * bytesPerPixel;
const pixels = Buffer.alloc(height * rowBytes);

for (let y = 0; y < height; y++) {
  const sourceOffset = y * (rowBytes + 1);
  const filter = rgb[sourceOffset];
  const rowOffset = y * rowBytes;
  for (let x = 0; x < rowBytes; x++) {
    const raw = rgb[sourceOffset + 1 + x];
    const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
    const above = y > 0 ? pixels[rowOffset + x - rowBytes] : 0;
    const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset + x - rowBytes - bytesPerPixel] : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = above;
    else if (filter === 3) predictor = Math.floor((left + above) / 2);
    else if (filter === 4) predictor = paeth(left, above, upperLeft);
    else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
    pixels[rowOffset + x] = (raw + predictor) & 0xff;
  }
}

const background = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let queueStart = 0;
let queueEnd = 0;
const isNearWhite = (index) => {
  const offset = index * bytesPerPixel;
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  return Math.min(red, green, blue) >= 238 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 32;
};

const visit = (index) => {
  if (background[index] || !isNearWhite(index)) return;
  background[index] = 1;
  queue[queueEnd++] = index;
};

for (let x = 0; x < width; x++) {
  visit(x);
  visit((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  visit(y * width);
  visit(y * width + width - 1);
}

while (queueStart < queueEnd) {
  const index = queue[queueStart++];
  const x = index % width;
  if (x > 0) visit(index - 1);
  if (x < width - 1) visit(index + 1);
  if (index >= width) visit(index - width);
  if (index < width * (height - 1)) visit(index + width);
}

const rgba = Buffer.alloc(height * (width * 4 + 1));
let minX = width;
let maxX = 0;
let minY = height;
let maxY = 0;
let hasVisiblePixel = false;
for (let y = 0; y < height; y++) {
  const destinationOffset = y * (width * 4 + 1);
  rgba[destinationOffset] = 0;
  for (let x = 0; x < width; x++) {
    const index = y * width + x;
    const sourceOffset = index * bytesPerPixel;
    const outputOffset = destinationOffset + 1 + x * 4;
    rgba[outputOffset] = pixels[sourceOffset];
    rgba[outputOffset + 1] = pixels[sourceOffset + 1];
    rgba[outputOffset + 2] = pixels[sourceOffset + 2];
    rgba[outputOffset + 3] = background[index] ? 0 : 255;
    if (!background[index]) {
      hasVisiblePixel = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
}

if (!hasVisiblePixel) throw new Error("The logo was fully removed; check the background threshold.");
const croppedWidth = maxX - minX + 1;
const croppedHeight = maxY - minY + 1;
const croppedRgba = Buffer.alloc(croppedHeight * (croppedWidth * 4 + 1));
for (let y = 0; y < croppedHeight; y++) {
  const sourceOffset = (minY + y) * (width * 4 + 1) + 1 + minX * 4;
  const destinationOffset = y * (croppedWidth * 4 + 1);
  croppedRgba[destinationOffset] = 0;
  rgba.copy(croppedRgba, destinationOffset + 1, sourceOffset, sourceOffset + croppedWidth * 4);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(croppedWidth, 0);
header.writeUInt32BE(croppedHeight, 4);
header[8] = 8;
header[9] = 6;
header[10] = 0;
header[11] = 0;
header[12] = 0;

const output = Buffer.concat([
  png.subarray(0, 8),
  makeChunk("IHDR", header),
  makeChunk("IDAT", deflateSync(croppedRgba)),
  makeChunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(outputPath, output);
console.log(`Saved a cropped transparent logo (${croppedWidth} × ${croppedHeight}): ${outputPath}`);
