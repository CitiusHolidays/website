/**
 * The two files that let the customer app open the website's sign-in and invite links directly
 * (ADR 0020): Apple's apple-app-site-association for Universal Links and Google's assetlinks.json
 * for Android App Links. With them, tapping the emailed sign-in link signs the traveller into the
 * installed app without the `/app/sign-in` page in between; the page stays the fallback for phones
 * without the app.
 *
 * The identifiers come from the environment, because they belong to the store accounts rather than
 * the code: `CUSTOMER_APP_APPLE_TEAM_ID` (the Apple Developer Team ID) and
 * `CUSTOMER_APP_ANDROID_CERT_SHA256` (the SHA-256 fingerprints of the Play app signing key and any
 * upload or internal-testing key, comma-separated). Set them in Vercel's Production environment
 * and redeploy: the files are built with the site. Until one is set its file is not served, and the
 * links keep opening the page.
 */

export const CUSTOMER_APP_ID = "com.citiusholidays.app";

/** The website paths the app answers. Keep in step with the app's associatedDomains and intentFilters. */
export const APP_LINK_PATHS = ["/app/sign-in", "/app/invite"] as const;

const TEAM_ID = /^[A-Z0-9]{10}$/;
const CERT_FINGERPRINT = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

type Env = Record<string, string | undefined>;

export function appleAppSiteAssociation(env: Env) {
  const teamId = env.CUSTOMER_APP_APPLE_TEAM_ID?.trim().toUpperCase() ?? "";
  if (!TEAM_ID.test(teamId)) {
    return null;
  }
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${CUSTOMER_APP_ID}`],
          components: APP_LINK_PATHS.flatMap((path) => [{ "/": path }, { "/": `${path}/` }]),
        },
      ],
    },
  };
}

export function androidAssetLinks(env: Env) {
  const fingerprints = (env.CUSTOMER_APP_ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => CERT_FINGERPRINT.test(value));
  if (fingerprints.length === 0) {
    return null;
  }
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: CUSTOMER_APP_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

/** Served as JSON with a short cache, so a corrected identifier reaches Apple's and Google's checks within the hour. */
export function associationResponse(
  body: ReturnType<typeof appleAppSiteAssociation> | ReturnType<typeof androidAssetLinks>
) {
  if (body === null) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
