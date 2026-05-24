import { describe, expect, test } from "bun:test";
import { portalFileErrorResponse, portalFileResponse } from "./file-response";

describe("portal file responses", () => {
  test("streams private no-store files with safe download headers", async () => {
    const response = portalFileResponse({
      base64: Buffer.from("passport bytes").toString("base64"),
      fileName: "passport\"\r\nscan.pdf",
      mimeType: "application/pdf",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
    expect(response.headers.get("Content-Disposition")).not.toContain("\r");
    expect(response.headers.get("Content-Disposition")).not.toContain("\n");
    expect(await response.text()).toBe("passport bytes");
  });

  test("maps forbidden file errors to 403", () => {
    const response = portalFileErrorResponse(new Error("FORBIDDEN"));
    expect(response.status).toBe(403);
  });
});
