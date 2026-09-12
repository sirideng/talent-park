// Reproducible data conversion, not a runtime dependency. USGS SRTM via Tilezen.
import { gunzipSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url =
  'https://elevation-tiles-prod.s3.amazonaws.com/skadi/N22/N22E114.hgt.gz';
const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
if (!response.ok) throw new Error(`DEM ${response.status}`);
const compressed = Buffer.from(await response.arrayBuffer()),
  raw = gunzipSync(compressed);
const side = Math.sqrt(raw.length / 2);
if (!Number.isInteger(side)) throw new Error('Invalid HGT');
const size = 121,
  extent = 600,
  heights = [];
for (let z = 0; z < size; z++)
  for (let x = 0; x < size; x++) {
    const lat = 22.58227 - (((z / (size - 1)) * 2 - 1) * extent) / 10000;
    const lon =
      114.21467 +
      (((x / (size - 1)) * 2 - 1) * extent) /
        10000 /
        Math.cos((22.58227 * Math.PI) / 180);
    const row = Math.round((23 - lat) * (side - 1)),
      col = Math.round((lon - 114) * (side - 1));
    const h = raw.readInt16BE((row * side + col) * 2);
    if (h < -1000) throw new Error('DEM void');
    heights.push(Math.max(0, h));
  }
await mkdir('app/wutong', { recursive: true });
await writeFile(
  'app/wutong/elevation.json',
  JSON.stringify({
    source: url,
    sha256: createHash('sha256').update(compressed).digest('hex'),
    size,
    extent,
    heights,
  }) + '\n',
);
console.log({
  size,
  range: [Math.min(...heights), Math.max(...heights)],
  bytes: compressed.length,
});
