import { describe, expect, test } from "bun:test";
import { PERMISSIONS } from "./lib";
import { getDownloadFile, getDownloadUrl } from "./queryAttachmentActions";

function operationDownloadContext(permission: string) {
  let calls = 0;
  return {
    runQuery: async () => {
      calls += 1;
      return calls === 1 ? { allowed: true, permissions: [permission] } : null;
    },
  };
}

describe("query attachment action access", () => {
  test("Job Card viewers pass both download action guards before record authorization", async () => {
    for (const action of [getDownloadUrl, getDownloadFile]) {
      await expect(
        (action as any)._handler(operationDownloadContext(PERMISSIONS.VIEW_JOB_CARDS), {
          attachmentId: "attachment_1",
        })
      ).rejects.toThrow("Attachment not found");
    }
  });

  test("unrelated roles remain forbidden", async () => {
    await expect(
      (getDownloadFile as any)._handler(operationDownloadContext(PERMISSIONS.VIEW_FINANCE), {
        attachmentId: "attachment_1",
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
