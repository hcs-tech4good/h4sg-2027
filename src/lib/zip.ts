// Minimal ZIP writer (stored, no compression). PDFs are already compressed,
// so storing them loses almost nothing and keeps this dependency-free.
// Limits of the classic format apply: under 65,535 entries and under 4 GB.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const MAX_ENTRIES = 0xffff;
const MAX_BYTES = 0xffffffff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date) {
  const year = Math.max(1980, d.getFullYear());
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

// Returns the archive as a list of byte chunks, ready for `new Blob(parts)`.
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array[] {
  if (entries.length > MAX_ENTRIES) throw new Error("Too many files for one ZIP");

  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith("/") || entry.name.split("/").includes("..")) {
      throw new Error(`Unsafe ZIP entry name: ${entry.name}`);
    }
    if (seen.has(entry.name)) throw new Error(`Duplicate ZIP entry name: ${entry.name}`);
    seen.add(entry.name);

    const name = encoder.encode(entry.name);
    const size = entry.data.length;
    const crc = crc32(entry.data);
    if (name.length > 0xffff) throw new Error("ZIP entry name too long");

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const header = new Uint8Array(46 + name.length);
    const cv = new DataView(header.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // local header offset
    header.set(name, 46);

    parts.push(local, entry.data);
    central.push(header);
    offset += local.length + size;
    if (offset > MAX_BYTES) throw new Error("ZIP would exceed 4 GB");
  }

  const centralSize = central.reduce((n, h) => n + h.length, 0);
  if (offset + centralSize > MAX_BYTES) throw new Error("ZIP would exceed 4 GB");

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return [...parts, ...central, end];
}
