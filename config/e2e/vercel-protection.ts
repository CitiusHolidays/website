export interface VercelProtectionHeaders {
  [header: string]: string;
}

export function vercelProtectionHeaders(
  env: Record<string, string | undefined> = process.env
): VercelProtectionHeaders {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret) {
    return {};
  }
  return {
    "x-vercel-protection-bypass": secret,
  };
}

export function vercelProtectionBrowserHeaders(
  env: Record<string, string | undefined> = process.env
): VercelProtectionHeaders {
  const headers = vercelProtectionHeaders(env);
  if (!("x-vercel-protection-bypass" in headers)) {
    return headers;
  }
  return {
    ...headers,
    "x-vercel-set-bypass-cookie": "true",
  };
}
