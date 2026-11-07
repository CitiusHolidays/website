import { convexTest } from "convex-test";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { encryptBuffer } from "../lib/encryption";
import schema from "../schema";
import { modules } from "../test.setup";

// Synthetic data only: generated images and a generated PDF header, never a real passport.
const NOW = Date.parse("2026-11-06T06:00:00Z");
// The trip runs 10-12 Nov, so field passports open 9 Nov 00:00 IST and close 13 Nov 24:00 IST.
const IN_WINDOW = Date.parse("2026-11-10T06:00:00Z");
const ISSUER = "https://field-passport-preview.test";
const SYNTHETIC_PDF = Buffer.from("%PDF-1.7\n% synthetic field passport\n%%EOF\n");

const previousKey = process.env.ENCRYPTION_KEY;
beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
});
afterAll(() => {
  if (previousKey === undefined) {
    Reflect.deleteProperty(process.env, "ENCRYPTION_KEY");
  } else {
    process.env.ENCRYPTION_KEY = previousKey;
  }
});
afterEach(() => {
  vi.useRealTimers();
});

const staff = {
  "ops-head": { name: "Synthetic Ops Head", roles: ["Operations Head"] },
  tm: { name: "Synthetic Tour Manager", roles: ["Tour Manager"] },
  "tm-co": { name: "Synthetic Co Manager", roles: ["Tour Manager"] },
  "tm-other": { name: "Synthetic Other Manager", roles: ["Tour Manager"] },
} as const;
type StaffKey = keyof typeof staff;
const STAFF_KEYS = ["ops-head", "tm", "tm-co", "tm-other"] as const satisfies readonly StaffKey[];

/**
 * A synthetic camera photo: the stored pixels are landscape (red left half, blue right half) and
 * EXIF orientation 6 says "rotate 90 degrees clockwise to display", so it shows as portrait with
 * red on top. It also carries a camera make and GPS position that must never reach the preview.
 */
async function syntheticCameraJpeg(width: number, height: number) {
  const half = Math.floor(width / 2);
  const red = await sharp({
    create: { background: { b: 30, g: 30, r: 220 }, channels: 3, height, width: half },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { background: { b: 220, g: 30, r: 30 }, channels: 3, height, width },
  })
    .composite([{ input: red, left: 0, top: 0 }])
    .withExif({
      IFD0: { Make: "SyntheticCam", Model: "Field Test 1" },
      IFD3: {
        GPSLatitude: "12/1 58/1 0/1",
        GPSLatitudeRef: "N",
        GPSLongitude: "77/1 35/1 0/1",
        GPSLongitudeRef: "E",
      },
    })
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function seed() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  const ids = await t.run(async (ctx) => {
    const staffIds: Partial<Record<StaffKey, Id<"staffUsers">>> = {};
    for (const key of STAFF_KEYS) {
      const identity = staff[key];
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${key}`,
        createdAt: NOW,
        legacyAuthUserId: key,
        status: "linked",
        updatedAt: NOW,
      });
      staffIds[key] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: key,
        createdAt: NOW,
        email: `${key}@field-passport-preview.test`,
        emailNormalized: `${key}@field-passport-preview.test`,
        name: identity.name,
        roles: [...identity.roles],
        updatedAt: NOW,
      });
    }
    const jobCardId = await ctx.db.insert("jobCards", {
      appPilot: {
        changedAt: NOW,
        changedBy: "synthetic-ops",
        changedByName: "Synthetic Ops",
        enabled: true,
      },
      clientName: "Synthetic preview group",
      confirmedPax: 2,
      createdAt: NOW,
      createdBy: "accounts-owner",
      destination: "Bali",
      jobCode: "JC-PREVIEW-01",
      queryType: "MICE",
      status: "Ready for Departure",
      travelEndDate: "2026-11-12",
      travelStartDate: "2026-11-10",
      updatedAt: NOW,
    });
    const traveller = (fullName: string) =>
      ctx.db.insert("travellers", {
        callingStatus: "Pending",
        contactNo: "+910000000000",
        createdAt: NOW,
        createdBy: "synthetic-ops",
        foodPreference: "Veg",
        fullName,
        guestType: "Employee",
        jobCardId,
        paymentType: "Company Paid",
        roomType: "Twin",
        ticketStatus: "Pending Issue",
        updatedAt: NOW,
        visaRequired: false,
        visaStatus: "Not Required",
      });
    return {
      jobCardId,
      pdf: await traveller("Synthetic Pdf Scan"),
      photo: await traveller("Synthetic Photo Scan"),
      staffIds,
    };
  });
  const actor = (key: StaffKey) =>
    t.withIdentity({
      email: `${key}@field-passport-preview.test`,
      issuer: ISSUER,
      subject: key,
      tokenIdentifier: `${ISSUER}|${key}`,
    });
  for (const staffId of [ids.staffIds.tm, ids.staffIds["tm-co"]]) {
    await actor("ops-head").mutation(api.crm.ops.createTourManager, {
      jobCardId: ids.jobCardId,
      name: "ignored for staff assignments",
      staffId,
    });
  }
  const storeScan = (travellerId: Id<"travellers">, bytes: Buffer, mimeType: string) =>
    t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([new Uint8Array(encryptBuffer(bytes))]));
      await ctx.db.insert("passportDetails", {
        createdAt: NOW,
        createdBy: "ops-head",
        encryptedPayload: "synthetic",
        expiryDate: "2031-01-01",
        fileName: mimeType === "application/pdf" ? "pdf-scan.pdf" : "photo-scan.jpg",
        mimeType,
        status: "Received",
        storageId,
        travellerId,
        updatedAt: NOW,
      });
      await ctx.db.patch("travellers", travellerId, { hasPassportScan: true });
    });
  const audit = () => t.run((ctx) => ctx.db.query("fieldPassportAccessAudit").collect());
  return { actor, audit, ids, storeScan, t };
}

describe("field passport preview", () => {
  test("an image scan's preview is a small upright JPEG with no EXIF or GPS", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    const scan = await syntheticCameraJpeg(3000, 2000);
    await f.storeScan(f.ids.photo, scan, "image/jpeg");
    expect((await sharp(scan).metadata()).exif).toBeDefined();

    const preview = await f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
      travellerId: f.ids.photo,
      variant: "preview",
    });
    if (!("variant" in preview && preview.variant === "preview")) {
      throw new Error(`expected a preview, got ${JSON.stringify(preview)}`);
    }
    expect(preview).toMatchObject({
      fileName: "photo-scan-preview.jpg",
      fullMimeType: "image/jpeg",
      // Stored 3000x2000 landscape with orientation 6 displays as 2000x3000 portrait.
      height: 900,
      mimeType: "image/jpeg",
      width: 600,
    });
    const bytes = Buffer.from(preview.bytes);
    expect(bytes.byteLength).toBeLessThan(scan.byteLength);
    expect(bytes.byteLength).toBeLessThan(150 * 1024);
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", height: 900, width: 600 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(bytes.includes(Buffer.from("SyntheticCam"))).toBe(false);

    // Rotated upright: the red half that was on the left is now on top.
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return { b: data[offset + 2], r: data[offset] };
    };
    const top = pixel(300, 100);
    const bottom = pixel(300, 800);
    expect(top.r).toBeGreaterThan(150);
    expect(top.b).toBeLessThan(90);
    expect(bottom.b).toBeGreaterThan(150);
    expect(bottom.r).toBeLessThan(90);
  });
});

describe("field passport variants", () => {
  test("a PDF has no preview; the full call completes the same open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    const tm = f.actor("tm");
    expect(
      await tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-pdf-1",
        travellerId: f.ids.pdf,
        variant: "preview",
      })
    ).toEqual({ variant: "none" });
    // The open starts, but it has served nothing yet.
    expect((await f.audit()).map((row) => [row.openId, row.variants])).toEqual([
      ["open-pdf-1", []],
    ]);

    const full = await tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
      openId: "open-pdf-1",
      travellerId: f.ids.pdf,
      variant: "full",
    });
    expect(full).toMatchObject({
      fileName: "pdf-scan.pdf",
      mimeType: "application/pdf",
      variant: "full",
    });
    expect(Object.keys(full).sort()).toEqual(["bytes", "fileName", "mimeType", "variant"]);
    if (!("variant" in full && full.variant === "full")) {
      throw new Error("expected the full file");
    }
    expect(Buffer.from(full.bytes).equals(SYNTHETIC_PDF)).toBe(true);
    expect((await f.audit()).map((row) => [row.openId, row.variants])).toEqual([
      ["open-pdf-1", ["full"]],
    ]);
  });

  test("an image sharp cannot read has no preview, and the row does not claim one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    const unreadable = Buffer.from("synthetic bytes that are not an image");
    await f.storeScan(f.ids.photo, unreadable, "image/jpeg");
    const read = (variant: "full" | "preview") =>
      f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-unreadable",
        travellerId: f.ids.photo,
        variant,
      });
    expect(await read("preview")).toEqual({ variant: "none" });
    expect((await f.audit()).map((row) => row.variants)).toEqual([[]]);
    const full = await read("full");
    expect(full).toMatchObject({ mimeType: "image/jpeg", variant: "full" });
    expect(Object.keys(full).sort()).toEqual(["bytes", "fileName", "mimeType", "variant"]);
    expect((await f.audit()).map((row) => row.variants)).toEqual([["full"]]);
  });

  test("without a variant the response is the original shape and every call is audited", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    const tm = f.actor("tm");
    for (const _ of [1, 2]) {
      const file = await tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        travellerId: f.ids.pdf,
      });
      expect(Object.keys(file).sort()).toEqual(["bytes", "fileName", "mimeType"]);
      expect(file).toMatchObject({ fileName: "pdf-scan.pdf", mimeType: "application/pdf" });
    }
    const rows = await f.audit();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.openId, row.variants])).toEqual([
      [undefined, ["full"]],
      [undefined, ["full"]],
    ]);
  });

  test("the full variant of an image reports its upright size", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    const scan = await syntheticCameraJpeg(1200, 800);
    await f.storeScan(f.ids.photo, scan, "image/jpeg");
    const full = await f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
      travellerId: f.ids.photo,
      variant: "full",
    });
    expect(full).toMatchObject({
      height: 1200,
      mimeType: "image/jpeg",
      variant: "full",
      width: 800,
    });
    if (!("variant" in full && full.variant === "full")) {
      throw new Error("expected the full file");
    }
    // The full scan is the stored file, byte for byte.
    expect(Buffer.from(full.bytes).equals(scan)).toBe(true);
  });
});

describe("one audit row per open", () => {
  test("preview and full with one openId share a row; without it each call writes one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(1200, 800), "image/jpeg");
    const read = (variant: "full" | "preview", openId?: string) =>
      f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId,
        travellerId: f.ids.photo,
        variant,
      });

    await read("preview", "open-a");
    await read("full", "open-a");
    await read("full", "open-a");
    let rows = await f.audit();
    expect(rows.map((row) => [row.openId, row.variants])).toEqual([
      ["open-a", ["preview", "full"]],
    ]);
    expect(rows[0]?.actorStaffId).toBe(f.ids.staffIds.tm);

    await read("preview");
    await read("full");
    rows = await f.audit();
    expect(rows.map((row) => [row.openId, row.variants])).toEqual([
      ["open-a", ["preview", "full"]],
      [undefined, ["preview"]],
      [undefined, ["full"]],
    ]);

    // The same openId more than ten minutes after the open starts a new open.
    vi.setSystemTime(IN_WINDOW + 10 * 60 * 1000 + 1);
    await read("full", "open-a");
    expect((await f.audit()).map((row) => [row.openId, row.variants])).toEqual([
      ["open-a", ["preview", "full"]],
      [undefined, ["preview"]],
      [undefined, ["full"]],
      ["open-a", ["full"]],
    ]);
  });

  test("an openId never joins another traveller's open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(1200, 800), "image/jpeg");
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    const tm = f.actor("tm");
    for (const travellerId of [f.ids.photo, f.ids.pdf]) {
      await tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-shared",
        travellerId,
        variant: "full",
      });
    }
    expect((await f.audit()).map((row) => row.travellerId)).toEqual([f.ids.photo, f.ids.pdf]);
  });

  test("another Tour Manager's call with the same openId is their own open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    for (const key of ["tm", "tm-co"] as const) {
      await f.actor(key).action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-guessed",
        travellerId: f.ids.pdf,
        variant: "full",
      });
    }
    expect((await f.audit()).map((row) => [row.actorStaffId, row.variants])).toEqual([
      [f.ids.staffIds.tm, ["full"]],
      [f.ids.staffIds["tm-co"], ["full"]],
    ]);
  });

  test("an unbounded openId is refused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    for (const openId of ["", "x".repeat(129), "open id"]) {
      await expect(
        f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
          openId,
          travellerId: f.ids.pdf,
          variant: "full",
        })
      ).rejects.toThrow("INVALID_OPEN_ID");
    }
    expect(await f.audit()).toEqual([]);
  });
});

describe("the rate limit counts opens", () => {
  test("preview plus full of one open count once against the portal file limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(600, 400), "image/jpeg");
    const tm = f.actor("tm");
    const read = (variant: "full" | "preview", openId?: string) =>
      tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId,
        travellerId: f.ids.photo,
        variant,
      });
    // The portal file limit is 30 downloads a minute; 28 single-call opens use 28 of them.
    for (let index = 0; index < 28; index += 1) {
      await read("full");
    }
    await read("preview", "open-29");
    await read("full", "open-29");
    // Had the preview and the full call counted twice, this 30th open would be refused.
    await read("preview", "open-30");
    await read("full", "open-30");
    await expect(read("preview", "open-31")).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
    expect(await f.audit()).toHaveLength(30);
  });

  test("serving a variant the open already served counts again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(600, 400), "image/jpeg");
    await f.t.run((ctx) =>
      ctx.db.insert("portalFileDownloadRateLimits", {
        authUserId: `${ISSUER}|tm`,
        count: 28,
        expiresAt: IN_WINDOW + 60_000,
        startedAt: IN_WINDOW,
      })
    );
    const read = (variant: "full" | "preview") =>
      f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-replayed",
        travellerId: f.ids.photo,
        variant,
      });
    await read("preview"); // 29: the open
    await read("full"); // still 29: same open
    await read("full"); // 30: a second full download
    await expect(read("full")).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
    await expect(read("preview")).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
    expect((await f.audit()).map((row) => row.variants)).toEqual([["preview", "full"]]);
  });

  test("a PDF preview call starts an open, so it is held to the limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    await f.t.run((ctx) =>
      ctx.db.insert("portalFileDownloadRateLimits", {
        authUserId: `${ISSUER}|tm`,
        count: 30,
        expiresAt: IN_WINDOW + 60_000,
        startedAt: IN_WINDOW,
      })
    );
    await expect(
      f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-pdf-limited",
        travellerId: f.ids.pdf,
        variant: "preview",
      })
    ).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
    expect(await f.audit()).toEqual([]);
  });
});

describe("a preview is held to every field passport check", () => {
  test("another Tour Manager, an office role, outside the window, pilot off", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(1200, 800), "image/jpeg");
    await f.storeScan(f.ids.pdf, SYNTHETIC_PDF, "application/pdf");
    const preview = (key: StaffKey, travellerId: Id<"travellers">) =>
      f.actor(key).action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-refused",
        travellerId,
        variant: "preview",
      });

    for (const travellerId of [f.ids.photo, f.ids.pdf]) {
      // No own assignment on the Job Card.
      await expect(preview("tm-other", travellerId)).rejects.toThrow("FORBIDDEN");
      // Office roles use the Staff Workspace, never the field path.
      await expect(preview("ops-head", travellerId)).rejects.toThrow("FORBIDDEN");
    }

    // Batchless trip 10-12 Nov: closed before 9 Nov 00:00 IST and after 13 Nov 24:00 IST.
    vi.setSystemTime(Date.parse("2026-11-08T18:29:00Z"));
    await expect(preview("tm", f.ids.photo)).rejects.toThrow("day before the trip starts");
    await expect(preview("tm", f.ids.pdf)).rejects.toThrow("day before the trip starts");
    vi.setSystemTime(Date.parse("2026-11-13T18:31:00Z"));
    await expect(preview("tm", f.ids.photo)).rejects.toThrow("day after it ends");

    vi.setSystemTime(IN_WINDOW);
    await f.t.run((ctx) => ctx.db.patch("jobCards", f.ids.jobCardId, { appPilot: undefined }));
    await expect(preview("tm", f.ids.photo)).rejects.toThrow("APP_PILOT_OFF");
    await expect(preview("tm", f.ids.pdf)).rejects.toThrow("APP_PILOT_OFF");
    expect(await f.audit()).toEqual([]);
  });

  test("a rate-limited caller gets no preview", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(600, 400), "image/jpeg");
    await f.t.run((ctx) =>
      ctx.db.insert("portalFileDownloadRateLimits", {
        authUserId: `${ISSUER}|tm`,
        count: 30,
        expiresAt: IN_WINDOW + 60_000,
        startedAt: IN_WINDOW,
      })
    );
    await expect(
      f.actor("tm").action(api.crm.fieldPassportActions.getFieldPassportFile, {
        openId: "open-limited",
        travellerId: f.ids.photo,
        variant: "preview",
      })
    ).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
    expect(await f.audit()).toEqual([]);
  });

  test("a refused call still counts against the rate limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(IN_WINDOW);
    const f = await seed();
    await f.storeScan(f.ids.photo, await syntheticCameraJpeg(600, 400), "image/jpeg");
    await f.t.run((ctx) =>
      ctx.db.insert("portalFileDownloadRateLimits", {
        authUserId: `${ISSUER}|tm`,
        count: 29,
        expiresAt: IN_WINDOW + 60_000,
        startedAt: IN_WINDOW,
      })
    );
    const tm = f.actor("tm");
    // A traveller with no scan is refused, and the refusal uses the last download of the minute.
    await expect(
      tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        travellerId: f.ids.pdf,
        variant: "preview",
      })
    ).rejects.toThrow("Passport document not found");
    await expect(
      tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
        travellerId: f.ids.photo,
        variant: "preview",
      })
    ).rejects.toThrow("PORTAL_FILE_RATE_LIMITED");
  });
});
