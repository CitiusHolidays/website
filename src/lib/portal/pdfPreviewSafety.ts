const PDF_STREAM = new TextEncoder().encode("stream");
const PDF_END_STREAM = new TextEncoder().encode("endstream");
const MAX_PDF_STREAM_BYTES = 32 * 1024 * 1024;
const MAX_PDF_TOTAL_STREAM_BYTES = 64 * 1024 * 1024;
const MAX_PDF_DICTIONARY_BYTES = 64 * 1024;
const PDF_DIRECT_LENGTH_PATTERN = /^\d+$/;
const PDF_NAME_ESCAPE_PATTERN = /#([0-9a-fA-F]{2})/g;
const SAFE_PREDECODED_FILTERS = new Set([
  "CCITTFaxDecode",
  "DCTDecode",
  "JBIG2Decode",
  "JPXDecode",
]);
const ASCII_TRANSPORT_FILTERS = new Set(["ASCII85Decode", "ASCIIHexDecode"]);

type PdfDictionaryToken =
  | { kind: "array-close" | "array-open" | "dict-close" | "dict-open" | "opaque" }
  | { kind: "name" | "word"; value: string };

function isPdfWhitespace(code: number) {
  return code === 0 || code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isPdfDelimiter(character: string) {
  return "()<>[]{}/%".includes(character);
}

function matchesAt(bytes: Uint8Array, needle: Uint8Array, offset: number) {
  if (offset + needle.length > bytes.length) {
    return false;
  }
  for (let index = 0; index < needle.length; index += 1) {
    if (bytes[offset + index] !== needle[index]) {
      return false;
    }
  }
  return true;
}

function indexOfBytes(bytes: Uint8Array, needle: Uint8Array, start: number) {
  for (let offset = start; offset <= bytes.length - needle.length; offset += 1) {
    if (matchesAt(bytes, needle, offset)) {
      return offset;
    }
  }
  return -1;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this bounded byte scanner must model PDF comments, strings, hex strings, and nested dictionaries in one stateful pass.
function dictionaryBefore(bytes: Uint8Array, streamOffset: number) {
  let dictionaryEnd = streamOffset - 1;
  while (dictionaryEnd >= 0 && [0, 9, 10, 12, 13, 32].includes(bytes[dictionaryEnd])) {
    dictionaryEnd -= 1;
  }
  if (!(dictionaryEnd >= 1 && bytes[dictionaryEnd - 1] === 0x3e && bytes[dictionaryEnd] === 0x3e)) {
    return null;
  }
  const firstOffset = Math.max(0, dictionaryEnd - MAX_PDF_DICTIONARY_BYTES);
  const dictionaryStarts: number[] = [];
  for (let offset = firstOffset; offset <= dictionaryEnd; offset += 1) {
    const code = bytes[offset];
    if (code === 0x25) {
      while (offset <= dictionaryEnd && bytes[offset] !== 0x0a && bytes[offset] !== 0x0d) {
        offset += 1;
      }
      continue;
    }
    if (code === 0x28) {
      let depth = 1;
      while (depth > 0 && offset < dictionaryEnd) {
        offset += 1;
        if (bytes[offset] === 0x5c) {
          offset += 1;
        } else if (bytes[offset] === 0x28) {
          depth += 1;
        } else if (bytes[offset] === 0x29) {
          depth -= 1;
        }
      }
      if (depth !== 0) {
        return null;
      }
      continue;
    }
    if (code === 0x3c && bytes[offset + 1] !== 0x3c) {
      while (offset <= dictionaryEnd && bytes[offset] !== 0x3e) {
        offset += 1;
      }
      if (offset > dictionaryEnd) {
        return null;
      }
      continue;
    }
    if (code === 0x3c && bytes[offset + 1] === 0x3c) {
      dictionaryStarts.push(offset);
      offset += 1;
      continue;
    }
    if (code === 0x3e && bytes[offset + 1] === 0x3e) {
      const dictionaryStart = dictionaryStarts.pop();
      if (offset + 1 === dictionaryEnd && dictionaryStart !== undefined) {
        return new TextDecoder("latin1").decode(bytes.subarray(dictionaryStart, dictionaryEnd + 1));
      }
      offset += 1;
    }
  }
  return null;
}

function decodePdfName(name: string) {
  const decoded = name.replace(PDF_NAME_ESCAPE_PATTERN, (_escape, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  if (decoded.includes("#")) {
    throw new Error("PDF name escape is malformed");
  }
  return decoded;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fail-closed PDF lexical tokenization keeps comments and opaque strings from masquerading as dictionary keys.
function pdfDictionaryTokens(dictionary: string) {
  const tokens: PdfDictionaryToken[] = [];
  let cursor = 0;
  while (cursor < dictionary.length) {
    const code = dictionary.charCodeAt(cursor);
    if (isPdfWhitespace(code)) {
      cursor += 1;
      continue;
    }
    if (dictionary[cursor] === "%") {
      while (
        cursor < dictionary.length &&
        dictionary[cursor] !== "\n" &&
        dictionary[cursor] !== "\r"
      ) {
        cursor += 1;
      }
      continue;
    }
    if (dictionary[cursor] === "(") {
      let depth = 1;
      cursor += 1;
      while (depth > 0 && cursor < dictionary.length) {
        if (dictionary[cursor] === "\\") {
          cursor += 2;
        } else {
          if (dictionary[cursor] === "(") {
            depth += 1;
          } else if (dictionary[cursor] === ")") {
            depth -= 1;
          }
          cursor += 1;
        }
      }
      if (depth !== 0) {
        throw new Error("PDF dictionary string is unterminated");
      }
      tokens.push({ kind: "opaque" });
      continue;
    }
    if (dictionary.startsWith("<<", cursor)) {
      tokens.push({ kind: "dict-open" });
      cursor += 2;
      continue;
    }
    if (dictionary.startsWith(">>", cursor)) {
      tokens.push({ kind: "dict-close" });
      cursor += 2;
      continue;
    }
    if (dictionary[cursor] === "<") {
      const end = dictionary.indexOf(">", cursor + 1);
      if (end < 0) {
        throw new Error("PDF dictionary hex string is unterminated");
      }
      tokens.push({ kind: "opaque" });
      cursor = end + 1;
      continue;
    }
    if (dictionary[cursor] === "[") {
      tokens.push({ kind: "array-open" });
      cursor += 1;
      continue;
    }
    if (dictionary[cursor] === "]") {
      tokens.push({ kind: "array-close" });
      cursor += 1;
      continue;
    }
    if (dictionary[cursor] === "/") {
      const start = cursor + 1;
      cursor = start;
      while (
        cursor < dictionary.length &&
        !isPdfWhitespace(dictionary.charCodeAt(cursor)) &&
        !isPdfDelimiter(dictionary[cursor])
      ) {
        cursor += 1;
      }
      if (cursor === start) {
        throw new Error("PDF dictionary contains an empty name");
      }
      tokens.push({ kind: "name", value: decodePdfName(dictionary.slice(start, cursor)) });
      continue;
    }
    const start = cursor;
    while (
      cursor < dictionary.length &&
      !isPdfWhitespace(dictionary.charCodeAt(cursor)) &&
      !isPdfDelimiter(dictionary[cursor])
    ) {
      cursor += 1;
    }
    if (cursor === start) {
      tokens.push({ kind: "opaque" });
      cursor += 1;
      continue;
    }
    tokens.push({ kind: "word", value: dictionary.slice(start, cursor) });
  }
  return tokens;
}

function topLevelValueIndices(tokens: PdfDictionaryToken[], names: Set<string>) {
  const indices: number[] = [];
  let dictionaryDepth = 0;
  let arrayDepth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "dict-open") {
      dictionaryDepth += 1;
    } else if (token.kind === "dict-close") {
      dictionaryDepth -= 1;
      if (dictionaryDepth < 0) {
        throw new Error("PDF stream dictionary is malformed");
      }
    } else if (token.kind === "array-open") {
      arrayDepth += 1;
    } else if (token.kind === "array-close") {
      arrayDepth -= 1;
      if (arrayDepth < 0) {
        throw new Error("PDF stream dictionary is malformed");
      }
    } else if (
      token.kind === "name" &&
      dictionaryDepth === 1 &&
      arrayDepth === 0 &&
      names.has(token.value)
    ) {
      indices.push(index + 1);
    }
  }
  if (dictionaryDepth !== 0 || arrayDepth !== 0) {
    throw new Error("PDF stream dictionary is malformed");
  }
  return indices;
}

function streamFilters(tokens: PdfDictionaryToken[]) {
  const valueIndices = topLevelValueIndices(tokens, new Set(["F", "Filter"]));
  if (valueIndices.length === 0) {
    return [];
  }
  if (valueIndices.length !== 1) {
    throw new Error("PDF stream filter declaration is ambiguous");
  }
  const [valueIndex] = valueIndices;
  const value = tokens[valueIndex];
  if (value?.kind === "word" && tokens[valueIndex + 1]?.kind === "word") {
    throw new Error("Indirect PDF stream filters are unsupported for safe preview");
  }
  if (value?.kind === "name") {
    return [value.value];
  }
  if (value?.kind !== "array-open") {
    throw new Error("PDF stream filter declaration is unsupported for safe preview");
  }
  const filters: string[] = [];
  for (let index = valueIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "array-close") {
      return filters;
    }
    if (token.kind !== "name") {
      throw new Error("PDF stream filter declaration is unsupported for safe preview");
    }
    filters.push(token.value);
  }
  throw new Error("PDF stream filter declaration is unsupported for safe preview");
}

function directStreamLength(tokens: PdfDictionaryToken[]) {
  const valueIndices = topLevelValueIndices(tokens, new Set(["Length"]));
  if (valueIndices.length !== 1) {
    return null;
  }
  const [valueIndex] = valueIndices;
  const value = tokens[valueIndex];
  if (value?.kind !== "word" || !PDF_DIRECT_LENGTH_PATTERN.test(value.value)) {
    return null;
  }
  const length = Number(value.value);
  return Number.isSafeInteger(length) ? length : null;
}

function streamDataStart(bytes: Uint8Array, streamOffset: number) {
  const offset = streamOffset + PDF_STREAM.length;
  if (bytes[offset] === 0x0d && bytes[offset + 1] === 0x0a) {
    return offset + 2;
  }
  if (bytes[offset] === 0x0a || bytes[offset] === 0x0d) {
    return offset + 1;
  }
  throw new Error("PDF stream does not start on a new line");
}

function runLengthDecodedSize(bytes: Uint8Array) {
  let decoded = 0;
  let offset = 0;
  while (offset < bytes.length) {
    const marker = bytes[offset];
    offset += 1;
    if (marker === 128) {
      return decoded;
    }
    if (marker <= 127) {
      const literalBytes = marker + 1;
      if (offset + literalBytes > bytes.length) {
        throw new Error("PDF run-length stream is corrupt");
      }
      decoded += literalBytes;
      offset += literalBytes;
    } else {
      if (offset >= bytes.length) {
        throw new Error("PDF run-length stream is corrupt");
      }
      decoded += 257 - marker;
      offset += 1;
    }
    if (decoded > MAX_PDF_STREAM_BYTES) {
      throw new Error("PDF stream expansion limit exceeded");
    }
  }
  throw new Error("PDF run-length stream has no end marker");
}

async function flateDecodedSize(bytes: Uint8Array, alreadyDecoded: number) {
  const reader = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  let decoded = 0;
  try {
    let result = await reader.read();
    while (!result.done) {
      decoded += result.value.byteLength;
      if (decoded > MAX_PDF_STREAM_BYTES || alreadyDecoded + decoded > MAX_PDF_TOTAL_STREAM_BYTES) {
        throw new Error("PDF stream expansion limit exceeded");
      }
      // biome-ignore lint/performance/noAwaitInLoops: streaming chunks are the memory-safety boundary for compressed PDF content.
      result = await reader.read();
    }
    return decoded;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function normalizedFilter(filter: string) {
  switch (filter) {
    case "A85":
      return "ASCII85Decode";
    case "AHx":
      return "ASCIIHexDecode";
    case "CCF":
      return "CCITTFaxDecode";
    case "DCT":
      return "DCTDecode";
    case "Fl":
      return "FlateDecode";
    case "LZW":
      return "LZWDecode";
    case "RL":
      return "RunLengthDecode";
    default:
      return filter;
  }
}

interface DecodedOutput {
  bytes: Uint8Array;
  length: number;
}

function decodedOutput(capacity: number): DecodedOutput {
  return {
    bytes: new Uint8Array(Math.min(MAX_PDF_STREAM_BYTES + 1, Math.max(1, capacity))),
    length: 0,
  };
}

function pushDecodedByte(output: DecodedOutput, value: number) {
  if (output.length >= output.bytes.byteLength || output.length >= MAX_PDF_STREAM_BYTES) {
    throw new Error("PDF stream expansion limit exceeded");
  }
  output.bytes[output.length] = value;
  output.length += 1;
}

function asciiHexNibble(byte: number) {
  if (byte >= 0x30 && byte <= 0x39) {
    return byte - 0x30;
  }
  if (byte >= 0x41 && byte <= 0x46) {
    return byte - 0x41 + 10;
  }
  if (byte >= 0x61 && byte <= 0x66) {
    return byte - 0x61 + 10;
  }
  throw new Error("PDF ASCIIHex stream is corrupt");
}

function asciiHexDecoded(bytes: Uint8Array) {
  const output = decodedOutput(Math.ceil(bytes.byteLength / 2));
  let highNibble: number | null = null;
  let ended = false;
  for (const byte of bytes) {
    if (isPdfWhitespace(byte)) {
      continue;
    }
    if (byte === 0x3e) {
      ended = true;
      break;
    }
    const value = asciiHexNibble(byte);
    if (highNibble === null) {
      highNibble = value;
    } else {
      pushDecodedByte(output, highNibble * 16 + value);
      highNibble = null;
    }
  }
  if (!ended) {
    throw new Error("PDF ASCIIHex stream has no end marker");
  }
  if (highNibble !== null) {
    pushDecodedByte(output, highNibble * 16);
  }
  return output.bytes.slice(0, output.length);
}

function appendAscii85Group(output: DecodedOutput, digits: number[], outputBytes = 4) {
  while (digits.length < 5) {
    digits.push(84);
  }
  let value = 0;
  for (const digit of digits) {
    value = value * 85 + digit;
  }
  if (value > 0xff_ff_ff_ff) {
    throw new Error("PDF ASCII85 stream is corrupt");
  }
  for (let shift = 24; shift >= 32 - outputBytes * 8; shift -= 8) {
    pushDecodedByte(output, Math.floor(value / 2 ** shift) % 256);
  }
}

function assertAscii85EndMarker(bytes: Uint8Array, offset: number) {
  let endOffset = offset + 1;
  while (endOffset < bytes.length && isPdfWhitespace(bytes[endOffset])) {
    endOffset += 1;
  }
  if (bytes[endOffset] !== 0x3e) {
    throw new Error("PDF ASCII85 stream has a malformed end marker");
  }
}

function appendAscii85ZeroShortcut(output: DecodedOutput, digits: number[]) {
  if (digits.length !== 0) {
    throw new Error("PDF ASCII85 stream is corrupt");
  }
  for (let index = 0; index < 4; index += 1) {
    pushDecodedByte(output, 0);
  }
}

function ascii85Digit(byte: number) {
  if (byte < 0x21 || byte > 0x75) {
    throw new Error("PDF ASCII85 stream is corrupt");
  }
  return byte - 0x21;
}

function ascii85Decoded(bytes: Uint8Array) {
  const output = decodedOutput(bytes.byteLength * 4);
  let digits: number[] = [];
  let ended = false;
  for (let offset = 0; offset < bytes.length; offset += 1) {
    const byte = bytes[offset];
    if (isPdfWhitespace(byte)) {
      continue;
    }
    if (byte === 0x7e) {
      assertAscii85EndMarker(bytes, offset);
      ended = true;
      break;
    }
    if (byte === 0x7a) {
      appendAscii85ZeroShortcut(output, digits);
      continue;
    }
    digits.push(ascii85Digit(byte));
    if (digits.length === 5) {
      appendAscii85Group(output, digits);
      digits = [];
    }
  }
  if (!ended) {
    throw new Error("PDF ASCII85 stream has no end marker");
  }
  if (digits.length === 1) {
    throw new Error("PDF ASCII85 stream is corrupt");
  }
  if (digits.length > 1) {
    const outputBytes = digits.length - 1;
    appendAscii85Group(output, digits, outputBytes);
  }
  return output.bytes.slice(0, output.length);
}

function decodeAsciiTransport(bytes: Uint8Array, filter: string) {
  if (filter === "ASCII85Decode") {
    return ascii85Decoded(bytes);
  }
  if (filter === "ASCIIHexDecode") {
    return asciiHexDecoded(bytes);
  }
  return bytes;
}

async function measuredStreamSize(
  streamBytes: Uint8Array,
  filters: string[],
  totalDecoded: number
) {
  if (filters.includes("LZWDecode") || filters.length > 2) {
    throw new Error("PDF stream filter chain is unsupported for safe preview");
  }
  if (
    filters.some(
      (filter) =>
        filter !== "FlateDecode" &&
        filter !== "RunLengthDecode" &&
        !ASCII_TRANSPORT_FILTERS.has(filter) &&
        !SAFE_PREDECODED_FILTERS.has(filter)
    )
  ) {
    throw new Error("PDF stream filter is unsupported for safe preview");
  }
  let decodedBytes = streamBytes;
  const [firstFilter, secondFilter] = filters;
  let terminalFilter = firstFilter;
  if (terminalFilter && ASCII_TRANSPORT_FILTERS.has(terminalFilter)) {
    decodedBytes = decodeAsciiTransport(streamBytes, terminalFilter);
    terminalFilter = secondFilter;
  } else if (filters.length > 1) {
    throw new Error("PDF stream filter chain is unsupported for safe preview");
  }
  if (terminalFilter === "FlateDecode") {
    return await flateDecodedSize(decodedBytes, totalDecoded);
  }
  if (terminalFilter === "RunLengthDecode") {
    return runLengthDecodedSize(decodedBytes);
  }
  return decodedBytes.byteLength;
}

export async function assertSafePdfStreams(input: ArrayBuffer) {
  const bytes = new Uint8Array(input);
  let cursor = 0;
  let totalDecoded = 0;
  while (cursor < bytes.length) {
    const streamOffset = indexOfBytes(bytes, PDF_STREAM, cursor);
    if (streamOffset < 0) {
      break;
    }
    const dictionary = dictionaryBefore(bytes, streamOffset);
    if (!dictionary) {
      cursor = streamOffset + PDF_STREAM.length;
      continue;
    }
    const dictionaryTokens = pdfDictionaryTokens(dictionary);
    const dataStart = streamDataStart(bytes, streamOffset);
    const declaredLength = directStreamLength(dictionaryTokens);
    const endStreamOffset =
      declaredLength === null
        ? indexOfBytes(bytes, PDF_END_STREAM, dataStart)
        : dataStart + declaredLength;
    const endMarkerOffset =
      declaredLength === null
        ? endStreamOffset
        : indexOfBytes(bytes, PDF_END_STREAM, endStreamOffset);
    if (
      endStreamOffset < dataStart ||
      endStreamOffset > bytes.length ||
      endMarkerOffset < endStreamOffset ||
      endMarkerOffset - endStreamOffset > 2
    ) {
      throw new Error("PDF stream exceeds the source bounds");
    }
    const filters = streamFilters(dictionaryTokens).map(normalizedFilter);
    const streamBytes = bytes.subarray(dataStart, endStreamOffset);
    // biome-ignore lint/performance/noAwaitInLoops: PDF streams are measured sequentially to cap aggregate decompression memory.
    const decoded = await measuredStreamSize(streamBytes, filters, totalDecoded);
    totalDecoded += decoded;
    if (decoded > MAX_PDF_STREAM_BYTES || totalDecoded > MAX_PDF_TOTAL_STREAM_BYTES) {
      throw new Error("PDF stream expansion limit exceeded");
    }
    cursor = endMarkerOffset + PDF_END_STREAM.length;
  }
}
