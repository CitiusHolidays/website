import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { computeConvexDeploymentSourceHash } from "./convex-source-fingerprint";
import type { E2eProvisioningTarget } from "./preflight";
import { vercelProtectionHeaders } from "./vercel-protection";

export interface ApprovedE2eTarget {
  convexSiteOrigin: string;
  convexSourceHash: string;
  frontendOrigin: string;
  id: string;
  revision: string;
  target: E2eProvisioningTarget;
}

interface ApprovedE2eTargetManifest {
  schemaVersion: 3;
  targets: ApprovedE2eTarget[];
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const TARGET_ID_PATTERNS: Record<E2eProvisioningTarget, RegExp> = {
  development: /^development-[A-Za-z0-9._:+-]+$/,
  preview: /^preview-[A-Za-z0-9._:+-]+$/,
};
const REVISION_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    throw new Error(`${path} contains an undeclared field`);
  }
}

function origin(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new Error(`${path} must be an absolute HTTP(S) origin`);
  }
  const parsed = new URL(value);
  if (
    !(parsed.protocol === "http:" || parsed.protocol === "https:") ||
    parsed.origin !== value ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${path} must be an absolute HTTP(S) origin`);
  }
  return parsed;
}

function assertTargetIdBindsConvexOrigin(
  target: E2eProvisioningTarget,
  targetId: string,
  convex: URL,
  path: string
) {
  const deployment = LOOPBACK_HOSTS.has(convex.hostname)
    ? "local"
    : (convex.hostname.split(".")[0] ?? "");
  const expectedPrefix = `${target}-${deployment}`;
  if (!(targetId === expectedPrefix || targetId.startsWith(`${expectedPrefix}-`))) {
    throw new Error(`${path}.id must bind the ${deployment} Convex deployment identity`);
  }
}

function parseApprovedTarget(entry: unknown, index: number, ids: Set<string>): ApprovedE2eTarget {
  const path = `E2E target manifest.targets[${index}]`;
  if (!isRecord(entry)) {
    throw new Error(`${path} must be an object`);
  }
  exactKeys(
    entry,
    ["convexSiteOrigin", "convexSourceHash", "frontendOrigin", "id", "revision", "target"],
    path
  );
  if (!(entry.target === "development" || entry.target === "preview")) {
    throw new Error(`${path}.target must be development or preview`);
  }
  if (typeof entry.id !== "string" || !TARGET_ID_PATTERNS[entry.target].test(entry.id)) {
    throw new Error(`${path}.id must begin with ${entry.target}- and be redaction-safe`);
  }
  if (typeof entry.revision !== "string" || !REVISION_PATTERN.test(entry.revision)) {
    throw new Error(`${path}.revision must be an exact 40-character Git revision`);
  }
  if (typeof entry.convexSourceHash !== "string" || !SHA256_PATTERN.test(entry.convexSourceHash)) {
    throw new Error(`${path}.convexSourceHash must be a SHA-256 digest`);
  }
  if (ids.has(entry.id)) {
    throw new Error(`${path}.id is duplicated`);
  }
  ids.add(entry.id);
  const frontend = origin(entry.frontendOrigin, `${path}.frontendOrigin`);
  const convex = origin(entry.convexSiteOrigin, `${path}.convexSiteOrigin`);
  const expectsLoopback = entry.target === "development";
  if (
    LOOPBACK_HOSTS.has(frontend.hostname) !== expectsLoopback ||
    LOOPBACK_HOSTS.has(convex.hostname) !== expectsLoopback
  ) {
    throw new Error(`${path} origins do not match the ${entry.target} target class`);
  }
  if (
    entry.target === "preview" &&
    (frontend.protocol !== "https:" || convex.protocol !== "https:")
  ) {
    throw new Error(`${path} Preview origins must use HTTPS`);
  }
  assertTargetIdBindsConvexOrigin(entry.target, entry.id, convex, path);
  return {
    convexSiteOrigin: convex.origin,
    convexSourceHash: entry.convexSourceHash,
    frontendOrigin: frontend.origin,
    id: entry.id,
    revision: entry.revision,
    target: entry.target,
  };
}

export function validateApprovedE2eTargetManifest(value: unknown): ApprovedE2eTargetManifest {
  if (!isRecord(value)) {
    throw new Error("E2E target manifest must be an object");
  }
  exactKeys(value, ["schemaVersion", "targets"], "E2E target manifest");
  if (value.schemaVersion !== 3 || !Array.isArray(value.targets) || value.targets.length === 0) {
    throw new Error("E2E target manifest must use schemaVersion 3 and define targets");
  }
  const ids = new Set<string>();
  const targets = value.targets.map((entry, index) => parseApprovedTarget(entry, index, ids));
  return { schemaVersion: 3, targets };
}

export function readApprovedE2eTarget(args: {
  baseUrl: string;
  convexSiteUrl?: string;
  manifestPath?: string;
  root?: string;
  target: E2eProvisioningTarget;
  targetId?: string;
}) {
  const root = resolve(args.root ?? process.cwd());
  const manifestRoot = resolve(root, ".scratch/e2e");
  const manifestPath = resolve(root, args.manifestPath ?? ".scratch/e2e/approved-targets.json");
  const relativePath = relative(manifestRoot, manifestPath);
  if (!relativePath || relativePath.startsWith("..")) {
    throw new Error("E2E_TARGET_MANIFEST must name a file below .scratch/e2e");
  }
  const targetId = args.targetId?.trim();
  if (!targetId) {
    throw new Error("E2E_TARGET_ID is required and must name an approved non-production target");
  }
  let manifest: ApprovedE2eTargetManifest;
  try {
    manifest = validateApprovedE2eTargetManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")) as unknown
    );
  } catch (error) {
    throw new Error(`Unable to validate approved E2E target manifest ${relativePath}`, {
      cause: error,
    });
  }
  const approved = manifest.targets.find((candidate) => candidate.id === targetId);
  if (!approved || approved.target !== args.target) {
    throw new Error(`E2E target ${targetId} is not approved for ${args.target}`);
  }
  if (new URL(args.baseUrl).origin !== approved.frontendOrigin) {
    throw new Error("BROWSER_SMOKE_BASE_URL does not match the approved frontend origin");
  }
  if (args.convexSiteUrl && new URL(args.convexSiteUrl).origin !== approved.convexSiteOrigin) {
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL does not match the approved Convex site origin");
  }
  return approved;
}

export async function verifyFrontendE2eIdentity(
  approved: ApprovedE2eTarget,
  fetchIdentity: typeof fetch = fetch
) {
  const response = await fetchIdentity(`${approved.frontendOrigin}/api/e2e/identity`, {
    headers: { accept: "application/json", ...vercelProtectionHeaders() },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Frontend E2E identity returned HTTP ${response.status}`);
  }
  const identity = (await response.json()) as Record<string, unknown>;
  if (
    identity.id !== approved.id ||
    identity.revision !== approved.revision ||
    identity.target !== approved.target ||
    identity.convexSiteOrigin !== approved.convexSiteOrigin
  ) {
    throw new Error("Frontend E2E identity does not match the approved target manifest");
  }
  return approved;
}

export async function verifyConvexE2eIdentity(
  approved: ApprovedE2eTarget,
  seedSecret = process.env.E2E_SEED_SECRET,
  fetchIdentity: typeof fetch = fetch,
  localSourceHash: () => string = () => computeConvexDeploymentSourceHash(process.cwd())
) {
  if (!seedSecret) {
    throw new Error("E2E_SEED_SECRET is required to verify the Convex E2E identity");
  }
  if (localSourceHash() !== approved.convexSourceHash) {
    throw new Error("Local Convex source fingerprint does not match the approved target manifest");
  }
  const response = await fetchIdentity(`${approved.convexSiteOrigin}/e2e/identity`, {
    headers: {
      accept: "application/json",
      "x-e2e-seed-secret": seedSecret,
      "x-e2e-target-id": approved.id,
    },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Convex E2E identity returned HTTP ${response.status}`);
  }
  const identity = (await response.json()) as Record<string, unknown>;
  if (
    identity.id !== approved.id ||
    identity.convexSourceHash !== approved.convexSourceHash ||
    identity.target !== approved.target ||
    identity.convexSiteOrigin !== approved.convexSiteOrigin
  ) {
    throw new Error("Convex E2E identity does not match the approved target manifest");
  }
  return approved;
}
