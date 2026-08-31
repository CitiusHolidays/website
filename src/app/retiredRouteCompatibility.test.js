import { describe, expect, test } from "bun:test";
import VendorAuthPage from "./(auth)/auth/vendor/page";
import VendorPage from "./(authenticated)/vendor/page";
import ChallengesPage from "./(public)/sacred-bharat/challenges/page";
import GroupPage from "./(public)/sacred-bharat/groups/[groupId]/page";
import LeaderboardPage from "./(public)/sacred-bharat/leaderboard/page";
import TrailPage from "./(public)/sacred-bharat/trails/[slug]/page";
import YatriPage from "./(public)/sacred-bharat/yatris/[slug]/page";

function expectRedirect(page, destination) {
  try {
    page();
    throw new Error("Expected the route to redirect");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error.digest).toBe(`NEXT_REDIRECT;replace;${destination};307;`);
  }
}

describe("Retired route compatibility", () => {
  test("keeps historical Sacred Bharat links pointed at the active edition", () => {
    for (const page of [ChallengesPage, GroupPage, LeaderboardPage, TrailPage, YatriPage]) {
      expectRedirect(page, "/sacred-bharat");
    }
  });

  test("keeps both Vendor inbound links but routes them to truthful contact", () => {
    expectRedirect(VendorAuthPage, "/contact");
    expectRedirect(VendorPage, "/contact");
  });
});
