const CENTRAL_DIRECTORY_SIGNATURE = 0x02_01_4b_50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06_05_4b_50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04_03_4b_50;
const MAX_END_RECORD_SEARCH_BYTES = 65_557;
const ZIP_COMPRESSION_DEFLATE = 8;
const ZIP_COMPRESSION_STORED = 0;

export interface OfficeArchiveLimits {
  maxArchiveEntries: number;
  maxArchiveEntryBytes: number;
  maxTotalInflatedBytes: number;
}

function findEndOfCentralDirectory(view: DataView) {
  const firstOffset = Math.max(0, view.byteLength - MAX_END_RECORD_SEARCH_BYTES);
  for (let offset = view.byteLength - 22; offset >= firstOffset; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("Office archive directory is missing or corrupt");
}

interface OfficeArchiveEntry {
  compressedBytes: number;
  compressionMethod: number;
  dataOffset: number;
  declaredInflatedBytes: number;
}

async function measuredInflatedSize(
  bytes: Uint8Array,
  entry: OfficeArchiveEntry,
  limits: OfficeArchiveLimits,
  alreadyInflatedBytes: number
) {
  if (entry.compressionMethod === ZIP_COMPRESSION_STORED) {
    return entry.compressedBytes;
  }
  if (entry.compressionMethod !== ZIP_COMPRESSION_DEFLATE) {
    throw new Error("Office archive compression method is unsupported");
  }
  const compressed = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedBytes);
  const compressedCopy = new Uint8Array(compressed.byteLength);
  compressedCopy.set(compressed);
  const reader = new Blob([compressedCopy.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  let inflatedBytes = 0;
  try {
    let result = await reader.read();
    while (!result.done) {
      inflatedBytes += result.value.byteLength;
      if (
        inflatedBytes > limits.maxArchiveEntryBytes ||
        alreadyInflatedBytes + inflatedBytes > limits.maxTotalInflatedBytes
      ) {
        throw new Error("Office archive actual expansion limit exceeded");
      }
      // biome-ignore lint/performance/noAwaitInLoops: streaming each chunk is the memory bound; buffering would reintroduce the expansion bomb.
      result = await reader.read();
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return inflatedBytes;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one bounded pass validates the linked central and local ZIP records before any parser sees bytes.
export async function assertSafeOfficeArchive(input: ArrayBuffer, limits: OfficeArchiveLimits) {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 22) {
    throw new Error("Office archive is empty or corrupt");
  }
  const endOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (
    entryCount === 0xff_ff ||
    directorySize === 0xff_ff_ff_ff ||
    directoryOffset === 0xff_ff_ff_ff
  ) {
    throw new Error("ZIP64 Office archives are not supported in preview");
  }
  if (entryCount < 1 || entryCount > limits.maxArchiveEntries) {
    throw new Error("Office archive entry limit exceeded");
  }
  if (directoryOffset + directorySize > view.byteLength) {
    throw new Error("Office archive directory exceeds the source bounds");
  }
  let offset = directoryOffset;
  let totalInflatedBytes = 0;
  const entries: OfficeArchiveEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      throw new Error("Office archive entry is corrupt");
    }
    const inflatedBytes = view.getUint32(offset + 24, true);
    if (inflatedBytes > limits.maxArchiveEntryBytes) {
      throw new Error("Office archive entry expansion limit exceeded");
    }
    totalInflatedBytes += inflatedBytes;
    if (totalInflatedBytes > limits.maxTotalInflatedBytes) {
      throw new Error("Office archive total expansion limit exceeded");
    }
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    if (flags % 2 !== 0) {
      throw new Error("Encrypted Office archives are not supported in preview");
    }
    if (
      localHeaderOffset + 30 > directoryOffset ||
      view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new Error("Office archive local entry is corrupt");
    }
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    if (dataOffset + compressedBytes > directoryOffset) {
      throw new Error("Office archive entry exceeds the source bounds");
    }
    entries.push({
      compressedBytes,
      compressionMethod,
      dataOffset,
      declaredInflatedBytes: inflatedBytes,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset > directoryOffset + directorySize) {
    throw new Error("Office archive directory is corrupt");
  }
  let measuredTotal = 0;
  for (const entry of entries) {
    // biome-ignore lint/performance/noAwaitInLoops: entries are measured sequentially to bound aggregate decompression memory.
    const measured = await measuredInflatedSize(bytes, entry, limits, measuredTotal);
    if (measured !== entry.declaredInflatedBytes) {
      throw new Error("Office archive declared expansion size does not match its content");
    }
    measuredTotal += measured;
  }
}
