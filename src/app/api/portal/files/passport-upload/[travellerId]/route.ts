import { anyApi } from "convex/server";
import { fetchAuthAction, getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";

const MAX_PASSPORT_BYTES = 15 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 128 * 1024;
const MAX_REQUEST_BYTES = MAX_PASSPORT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

type FetchAuthAction = typeof fetchAuthAction;
type UploadFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface PassportUploadRouteOptions {
  fetchAuthActionImpl?: FetchAuthAction;
  getTokenImpl?: typeof getToken;
  serverSecret?: string;
  uploadFetchImpl?: UploadFetch;
}

function privateJson(error: string, status: number) {
  return Response.json(
    { error },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
      status,
    }
  );
}

function hasTrustedUploadOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readRequestBytes(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[],
  totalBytes: number
): Promise<{ bytes?: Uint8Array; ok: boolean; tooLarge?: boolean }> {
  const { done, value } = await reader.read();
  if (done) {
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, ok: true };
  }
  const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
  const nextTotal = totalBytes + chunk.byteLength;
  if (nextTotal > MAX_REQUEST_BYTES) {
    await reader.cancel("passport upload exceeds limit").catch(() => undefined);
    return { ok: false, tooLarge: true };
  }
  return await readRequestBytes(reader, [...chunks, chunk], nextTotal);
}

async function boundedFormData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return { error: "too_large" as const };
  }
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return { error: "invalid" as const };
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return { error: "invalid" as const };
  }
  const result = await readRequestBytes(reader, [], 0);
  if (!(result.ok && result.bytes)) {
    return { error: result.tooLarge ? ("too_large" as const) : ("invalid" as const) };
  }
  try {
    const body = Uint8Array.from(result.bytes).buffer;
    const boundedRequest = new Request("http://passport-upload.local", {
      body,
      headers: { "Content-Type": contentType },
      method: "POST",
    });
    return { formData: await boundedRequest.formData() };
  } catch {
    return { error: "invalid" as const };
  }
}

function optionalFormText(form: FormData, key: string) {
  const value = form.get(key);
  return isRuntimeString(value) && value.trim() ? value.trim() : undefined;
}

function safeFileName(value: string) {
  return (
    value
      .replace(/[\r\n\\/]/g, "_")
      .trim()
      .slice(0, 180) || "passport-document"
  );
}

async function sha256Base64(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export async function handlePassportUpload(
  request: Request,
  travellerId: string,
  {
    fetchAuthActionImpl = fetchAuthAction,
    getTokenImpl = getToken,
    serverSecret = process.env.PORTAL_FILE_UPLOAD_SECRET,
    uploadFetchImpl = fetch,
  }: PassportUploadRouteOptions = {}
) {
  if (!serverSecret) {
    return privateJson("Passport upload is not configured", 503);
  }
  if (!hasTrustedUploadOrigin(request)) {
    return privateJson("FORBIDDEN", 403);
  }
  const token = await getTokenImpl();
  if (!token) {
    return privateJson("FORBIDDEN", 403);
  }
  const parsed = await boundedFormData(request);
  if (parsed.error === "too_large") {
    return privateJson("Passport scans must be 15 MB or smaller", 413);
  }
  if (!parsed.formData) {
    return privateJson("Choose a valid passport scan", 400);
  }
  const file = parsed.formData.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_PASSPORT_BYTES) {
    return privateJson("Choose a valid passport scan", 400);
  }

  let storageId: string | null = null;
  let uploadToken: string | null = null;
  try {
    const contentDigest = await sha256Base64(file);
    const {
      storageContentType,
      uploadToken: issuedUploadToken,
      uploadUrl,
    } = await fetchAuthActionImpl(
      anyApi.crm.passportActions.generateUploadUrl,
      {
        contentDigest,
        fileSize: file.size,
        mimeType: file.type,
        serverSecret,
        travellerId,
      },
      { token }
    );
    uploadToken = issuedUploadToken;
    const uploadResponse = await uploadFetchImpl(uploadUrl, {
      body: file,
      headers: { "Content-Type": storageContentType },
      method: "POST",
    });
    if (!uploadResponse.ok) {
      return privateJson("Unable to upload this passport scan", 502);
    }
    const uploadResult = await uploadResponse.json();
    if (
      !(
        isRuntimeObject(uploadResult) &&
        "storageId" in uploadResult &&
        isRuntimeString(uploadResult.storageId)
      )
    ) {
      return privateJson("Unable to confirm this passport upload", 502);
    }
    ({ storageId } = uploadResult);
    await fetchAuthActionImpl(
      anyApi.crm.passportActions.encryptAndStorePassport,
      {
        dateOfBirth: optionalFormText(parsed.formData, "dateOfBirth"),
        expiryDate: optionalFormText(parsed.formData, "expiryDate"),
        fileName: safeFileName(file.name),
        fileSize: file.size,
        mimeType: file.type,
        nationality: optionalFormText(parsed.formData, "nationality"),
        number: optionalFormText(parsed.formData, "number"),
        serverSecret,
        tempStorageId: storageId,
        travellerId,
        uploadToken,
      },
      { token }
    );
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch {
    if (storageId && uploadToken) {
      await fetchAuthActionImpl(
        anyApi.crm.passportActions.discardPassportUpload,
        { serverSecret, storageId, travellerId, uploadToken },
        { token }
      ).catch(() => undefined);
    }
    return privateJson("Unable to process this passport scan", 400);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/portal/files/passport-upload/[travellerId]">
) {
  return await withApiRequestLogging(
    request,
    "/api/portal/files/passport-upload/[travellerId]",
    async () => {
      const { travellerId } = await params;
      return await handlePassportUpload(request, travellerId);
    }
  );
}
