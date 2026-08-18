import { describe, expect, test } from "bun:test";
import { assertSafePdfStreams } from "./pdfPreviewSafety";

async function deflate(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function ascii85Encode(bytes: Uint8Array) {
  let encoded = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    const remaining = Math.min(4, bytes.byteLength - offset);
    let value = 0;
    for (let index = 0; index < 4; index += 1) {
      value = value * 256 + (bytes[offset + index] ?? 0);
    }
    if (remaining === 4 && value === 0) {
      encoded += "z";
      continue;
    }
    const characters = Array.from({ length: 5 }, () => "!");
    for (let index = 4; index >= 0; index -= 1) {
      characters[index] = String.fromCharCode((value % 85) + 33);
      value = Math.floor(value / 85);
    }
    encoded += characters.slice(0, remaining + 1).join("");
  }
  return new TextEncoder().encode(`${encoded}~>`);
}

function pdfWithStream(compressed: Uint8Array, declaredLength = compressed.byteLength) {
  const prefix = new TextEncoder().encode(
    `%PDF-1.7\n1 0 obj\n<< /Length ${declaredLength} /Filter /FlateDecode >>\nstream\n`
  );
  const suffix = new TextEncoder().encode("\nendstream\nendobj\n%%EOF\n");
  const bytes = new Uint8Array(prefix.byteLength + compressed.byteLength + suffix.byteLength);
  bytes.set(prefix);
  bytes.set(compressed, prefix.byteLength);
  bytes.set(suffix, prefix.byteLength + compressed.byteLength);
  return bytes.buffer;
}

function pdfWithFilterDeclaration(compressed: Uint8Array, filter: string) {
  const prefix = new TextEncoder().encode(
    `%PDF-1.7\n1 0 obj\n<< /Length ${compressed.byteLength} ${filter} >>\nstream\n`
  );
  const suffix = new TextEncoder().encode("\nendstream\nendobj\n%%EOF\n");
  const bytes = new Uint8Array(prefix.byteLength + compressed.byteLength + suffix.byteLength);
  bytes.set(prefix);
  bytes.set(compressed, prefix.byteLength);
  bytes.set(suffix, prefix.byteLength + compressed.byteLength);
  return bytes.buffer;
}

describe("PDF stream safety", () => {
  test("Accepts a bounded Flate content stream", async () => {
    await expect(
      assertSafePdfStreams(pdfWithStream(await deflate("BT (Hello) Tj ET")))
    ).resolves.toBeUndefined();
  });

  test("Rejects a small compressed stream that expands beyond the per-stream budget", async () => {
    const compressed = await deflate("x".repeat(33 * 1024 * 1024));
    await expect(assertSafePdfStreams(pdfWithStream(compressed))).rejects.toThrow(
      "expansion limit"
    );
  });

  test("Recognizes the shorthand filter key and rejects indirect filters fail closed", async () => {
    const bounded = await deflate("BT (Hello) Tj ET");
    await expect(
      assertSafePdfStreams(pdfWithFilterDeclaration(bounded, "/F /Fl"))
    ).resolves.toBeUndefined();
    await expect(
      assertSafePdfStreams(pdfWithFilterDeclaration(bounded, "/Filter 9 0 R"))
    ).rejects.toThrow("Indirect PDF stream filters");
    await expect(
      assertSafePdfStreams(pdfWithFilterDeclaration(bounded, "/Filter /Flate#44ecode"))
    ).resolves.toBeUndefined();
    await expect(
      assertSafePdfStreams(pdfWithFilterDeclaration(bounded, "/Filter /UnknownCodec"))
    ).rejects.toThrow("filter is unsupported");
  });

  test("Ignores token-looking filter names inside PDF strings and comments", async () => {
    const bounded = await deflate("BT (Hello) Tj ET");
    await expect(
      assertSafePdfStreams(
        pdfWithFilterDeclaration(
          bounded,
          "(pretend /Filter /DCTDecode) % /Filter /DCTDecode\n/Filter /FlateDecode"
        )
      )
    ).resolves.toBeUndefined();
    await expect(
      assertSafePdfStreams(
        pdfWithFilterDeclaration(bounded, "/Metadata << /Filter /DCTDecode >> /Filter /Fl")
      )
    ).resolves.toBeUndefined();
  });

  test("Accepts the bounded ASCII85 and Flate filter chain emitted by ReportLab", async () => {
    const compressed = await deflate("BT (ReportLab resume) Tj ET");

    await expect(
      assertSafePdfStreams(
        pdfWithFilterDeclaration(
          ascii85Encode(compressed),
          "/Filter [ /ASCII85Decode /FlateDecode ]"
        )
      )
    ).resolves.toBeUndefined();
  });
});
