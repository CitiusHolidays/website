import { describe, expect, test } from "bun:test";
import {
  androidAssetLinks,
  appleAppSiteAssociation,
  associationResponse,
} from "./appLinkAssociation";

const FINGERPRINT = Array.from({ length: 32 }, (_, i) =>
  i.toString(16).padStart(2, "0").toUpperCase()
).join(":");

describe("Customer app link association files", () => {
  test("Lets only the Citius app on the configured Apple team open sign-in and invite links", () => {
    expect(appleAppSiteAssociation({ CUSTOMER_APP_APPLE_TEAM_ID: " ab12cd34ef " })).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["AB12CD34EF.com.citiusholidays.app"],
            components: [
              { "/": "/app/sign-in" },
              { "/": "/app/sign-in/" },
              { "/": "/app/invite" },
              { "/": "/app/invite/" },
            ],
          },
        ],
      },
    });
  });

  test("Lists every well-formed Android signing fingerprint and drops anything else", () => {
    expect(
      androidAssetLinks({
        CUSTOMER_APP_ANDROID_CERT_SHA256: `${FINGERPRINT.toLowerCase()}, not-a-key`,
      })
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.citiusholidays.app",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ]);
  });

  test("Serves nothing until the store identifiers are configured, so links keep opening the page", () => {
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ CUSTOMER_APP_APPLE_TEAM_ID: "not a team" })).toBeNull();
    expect(androidAssetLinks({ CUSTOMER_APP_ANDROID_CERT_SHA256: "" })).toBeNull();
    expect(associationResponse(null).status).toBe(404);
  });

  test("Answers as JSON with a short cache", async () => {
    const body = appleAppSiteAssociation({ CUSTOMER_APP_APPLE_TEAM_ID: "AB12CD34EF" });
    const response = associationResponse(body);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await response.json()).toEqual(body);
  });
});
