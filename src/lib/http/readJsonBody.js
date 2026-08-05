export function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readBytesWithinLimit(request, maxBytes) {
  const reader = request.body?.getReader?.();
  if (!reader) {
    try {
      const bytes = await request.arrayBuffer();
      return bytes.byteLength > maxBytes
        ? { ok: false, reason: "too_large" }
        : { bytes: new Uint8Array(bytes), ok: true };
    } catch {
      return { ok: false, reason: "invalid_body" };
    }
  }

  const chunks = [];
  let totalBytes = 0;
  let streamDone = false;
  try {
    // Each read is intentionally sequential so backpressure is preserved and the stream can be
    // cancelled immediately when the byte budget is exceeded.
    while (!streamDone) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential reads are required for backpressure.
      const { done, value } = await reader.read();
      streamDone = done;
      if (streamDone) {
        break;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body exceeds limit").catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(chunk);
    }
  } catch {
    return { ok: false, reason: "invalid_body" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, ok: true };
}

export async function readJsonBodyWithinLimit(request, maxBytes) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const bytesResult = await readBytesWithinLimit(request, maxBytes);
  if (!bytesResult.ok) {
    return bytesResult;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytesResult.bytes)) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
