import { describe, expect, test } from "bun:test";
import {
  normalizeLegacyRoomType,
  resolveRoomCategory,
  resolveTravellerRoomFields,
} from "./roomTypes";

describe("roomTypes migration helpers", () => {
  test("resolveRoomCategory maps legacy codes", () => {
    expect(resolveRoomCategory("SGL")).toBe("Single");
    expect(resolveRoomCategory("DBL")).toBe("Double");
    expect(resolveRoomCategory("TPL")).toBe("Triple");
    expect(resolveRoomCategory("Twin")).toBe("Twin");
  });

  test("normalizeLegacyRoomType maps legacy codes", () => {
    expect(normalizeLegacyRoomType("SGL")).toBe("Single");
    expect(normalizeLegacyRoomType("DBL")).toBe("Double");
    expect(normalizeLegacyRoomType("TPL")).toBe("Triple");
    expect(normalizeLegacyRoomType("Twin")).toBe("Twin");
  });

  test("resolveTravellerRoomFields syncs room type from migrated hotel allocation", () => {
    expect(resolveTravellerRoomFields("Twin", "SGL")).toEqual({
      hotelAllocation: "Single",
      roomType: "Single",
    });
  });

  test("resolveTravellerRoomFields fixes room type when allocation was already migrated", () => {
    expect(resolveTravellerRoomFields("Twin", "Single")).toEqual({
      hotelAllocation: "Single",
      roomType: "Single",
    });
  });

  test("resolveTravellerRoomFields updates both fields when room type is legacy", () => {
    expect(resolveTravellerRoomFields("SGL", "SGL")).toEqual({
      hotelAllocation: "Single",
      roomType: "Single",
    });
  });

  test("resolveTravellerRoomFields leaves hotel names on allocation unchanged", () => {
    expect(resolveTravellerRoomFields("Twin", "Taj Delhi")).toEqual({
      hotelAllocation: "Taj Delhi",
      roomType: "Twin",
    });
  });
});
