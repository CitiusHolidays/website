import { expect, test } from "bun:test";
import { leaveUnsavedThroughDocument } from "./unsavedNavigation";

function navigation(dirty: boolean) {
  const assigned: string[] = [];
  let prevented = false;
  leaveUnsavedThroughDocument(dirty, "/pilgrimage", (url) => assigned.push(url))({
    preventDefault: () => {
      prevented = true;
    },
  });
  return { assigned, prevented };
}

test("saved booth links keep Next.js client navigation", () => {
  expect(navigation(false)).toEqual({ assigned: [], prevented: false });
});

test("unsaved booth links leave through a document load so beforeunload still guards the photo", () => {
  expect(navigation(true)).toEqual({ assigned: ["/pilgrimage"], prevented: true });
});
