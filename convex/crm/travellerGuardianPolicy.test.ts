import { describe, expect, test } from "bun:test";
import {
  ageOnDate,
  type GuardianCandidate,
  guardianLinkProblem,
  guardianSetProblem,
  MAX_GUARDIANS,
  minorReferenceDate,
  normalizeIsoDate,
  resolveGuardianReference,
  resolveGuardianReferences,
  resolveMinorStatus,
} from "./travellerGuardianPolicy";

const parent: GuardianCandidate = {
  contactNo: "+91 98765 00001",
  email: "parent@example.test",
  fullName: "Meera Iyer",
  id: "parent",
  isMinor: false,
  jobCardId: "job",
};
const child: GuardianCandidate = {
  fullName: "Kavya Iyer",
  id: "child",
  isMinor: true,
  jobCardId: "job",
};

describe("minor status", () => {
  test("Counts a traveller as a minor until the day they turn 18", () => {
    expect(ageOnDate("2008-12-01", "2026-11-30")).toBe(17);
    expect(ageOnDate("2008-12-01", "2026-12-01")).toBe(18);
    expect(resolveMinorStatus({ birthDate: "2008-12-01" }, "2026-11-30")).toBe(true);
    expect(resolveMinorStatus({ birthDate: "2008-12-01" }, "2026-12-01")).toBe(false);
  });

  test("Prefers an explicit Minor column, then Age, then date of birth", () => {
    expect(
      resolveMinorStatus({ birthDate: "1980-01-01", minorStatus: "minor" }, "2026-11-30")
    ).toBe(true);
    expect(resolveMinorStatus({ ageYears: 12, birthDate: "1980-01-01" }, "2026-11-30")).toBe(true);
    expect(resolveMinorStatus({ ageYears: 40 }, "2026-11-30")).toBe(false);
  });

  test("Leaves minor status unknown without usable evidence", () => {
    expect(resolveMinorStatus({}, "2026-11-30")).toBeUndefined();
    expect(resolveMinorStatus({ birthDate: "UNKNOWN" }, "2026-11-30")).toBeUndefined();
    expect(resolveMinorStatus({ ageYears: -2 }, "2026-11-30")).toBeUndefined();
    expect(resolveMinorStatus({ birthDate: "2030-01-01" }, "2026-11-30")).toBeUndefined();
  });

  test("Measures age on the series start, then the Job Card start, then today", () => {
    expect(minorReferenceDate("2026-12-10", "2026-12-01", 0)).toBe("2026-12-10");
    expect(minorReferenceDate("", "2026-12-01", 0)).toBe("2026-12-01");
    expect(minorReferenceDate(undefined, "not a date", Date.UTC(2026, 10, 6))).toBe("2026-11-06");
  });

  test("Normalizes only real calendar dates", () => {
    expect(normalizeIsoDate("2012-02-29")).toBe("2012-02-29");
    expect(normalizeIsoDate("2013-02-29")).toBeNull();
    expect(normalizeIsoDate("29/02/2012")).toBeNull();
  });
});

describe("guardian references from a spreadsheet", () => {
  test("Links a minor to the one adult with that name on the Job Card", () => {
    expect(resolveGuardianReference(child, { name: "  meera  IYER " }, [parent, child])).toEqual({
      guardianId: "parent",
      kind: "linked",
    });
  });

  test("Matches given name and surname written in either order", () => {
    const split = { ...parent, fullName: "Iyer Meera", givenName: "Meera", surname: "Iyer" };
    expect(resolveGuardianReference(child, { name: "Iyer, Meera" }, [split, child])).toEqual({
      guardianId: "parent",
      kind: "linked",
    });
  });

  test("Uses the contact to choose between two adults with the same name", () => {
    const namesake = { ...parent, contactNo: "+91 90000 00002", email: "", id: "namesake" };
    const candidates = [parent, namesake, child];
    expect(resolveGuardianReference(child, { name: "Meera Iyer" }, candidates)).toMatchObject({
      kind: "ambiguous",
    });
    expect(
      resolveGuardianReference(child, { contact: "9876500001", name: "Meera Iyer" }, candidates)
    ).toEqual({ guardianId: "parent", kind: "linked" });
    expect(
      resolveGuardianReference(
        child,
        { contact: "PARENT@example.test", name: "Meera Iyer" },
        candidates
      )
    ).toEqual({ guardianId: "parent", kind: "linked" });
  });

  test("Refuses a name match whose contact disagrees", () => {
    expect(
      resolveGuardianReference(child, { contact: "+91 90000 99999", name: "Meera Iyer" }, [
        parent,
        child,
      ])
    ).toMatchObject({ kind: "contact_mismatch" });
  });

  test("Never names a minor, the traveller themself, or an absent person as guardian", () => {
    const sibling = { ...child, fullName: "Arjun Iyer", id: "sibling" };
    expect(resolveGuardianReference(child, { name: "Arjun Iyer" }, [sibling, child])).toMatchObject(
      { kind: "guardian_is_minor" }
    );
    expect(resolveGuardianReference(child, { name: "Kavya Iyer" }, [child])).toMatchObject({
      kind: "self",
    });
    expect(resolveGuardianReference(child, { name: "Somebody Else" }, [parent])).toMatchObject({
      kind: "unmatched",
    });
  });

  test("Prefers the adult when a parent and child share a name", () => {
    const junior = { ...child, fullName: "Meera Iyer", id: "junior" };
    expect(resolveGuardianReference(child, { name: "Meera Iyer" }, [parent, junior])).toEqual({
      guardianId: "parent",
      kind: "linked",
    });
  });

  test("Only links travellers known to be minors", () => {
    expect(
      resolveGuardianReference({ ...child, isMinor: undefined }, { name: "Meera Iyer" }, [parent])
    ).toMatchObject({ kind: "age_unknown" });
    expect(
      resolveGuardianReference({ ...child, isMinor: false }, { name: "Meera Iyer" }, [parent])
    ).toMatchObject({ kind: "not_minor" });
  });
});

describe("manual guardian links", () => {
  test("Accepts an adult on the same Job Card", () => {
    expect(guardianLinkProblem(child, parent)).toBeNull();
    expect(guardianLinkProblem(child, { ...parent, isMinor: undefined })).toBeNull();
  });

  test("Rejects self, other Job Cards, minors as guardians, and non-minors", () => {
    expect(guardianLinkProblem(child, child)).toMatch("own guardian");
    expect(guardianLinkProblem(child, { ...parent, jobCardId: "other" })).toMatch("same Job Card");
    expect(guardianLinkProblem(child, { ...parent, isMinor: true })).toMatch(
      "cannot be a guardian"
    );
    expect(guardianLinkProblem({ ...child, isMinor: false }, parent)).toMatch("minor");
  });
});

describe("two guardians", () => {
  const father: GuardianCandidate = {
    contactNo: "+91 98765 00002",
    fullName: "Ravi Iyer",
    id: "father",
    isMinor: false,
    jobCardId: "job",
  };
  const roster = [parent, father, child];

  test("Allows at most two guardians per minor", () => {
    expect(MAX_GUARDIANS).toBe(2);
  });

  test("Links both parents named in the sheet, each matched on its own", () => {
    expect(
      resolveGuardianReferences(
        child,
        [{ name: "Meera Iyer" }, { name: "Ravi Iyer" }],
        () => roster
      )
    ).toEqual({ guardianIds: ["parent", "father"], unresolved: [] });
  });

  test("Links the parent that matches and reports the one that does not", () => {
    const result = resolveGuardianReferences(
      child,
      [{ name: "Meera Iyer" }, { name: "Somebody Else" }],
      () => roster
    );
    expect(result.guardianIds).toEqual(["parent"]);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]?.reference).toEqual({ name: "Somebody Else" });
    expect(result.unresolved[0]?.message).toContain("no traveller with that name");
  });

  test("Does not link the same adult twice or more than two adults", () => {
    const duplicate = resolveGuardianReferences(
      child,
      [{ name: "Meera Iyer" }, { contact: "9876500001", name: "meera iyer" }],
      () => roster
    );
    expect(duplicate.guardianIds).toEqual(["parent"]);
    expect(duplicate.unresolved[0]?.message).toContain("already named");

    const third = { ...father, fullName: "Asha Iyer", id: "aunt" };
    const tooMany = resolveGuardianReferences(
      child,
      [{ name: "Meera Iyer" }, { name: "Ravi Iyer" }, { name: "Asha Iyer" }],
      () => [...roster, third]
    );
    expect(tooMany.guardianIds).toEqual(["parent", "father"]);
    expect(tooMany.unresolved[0]?.message).toContain("at most two guardians");
  });

  test("Rejects a manual set with duplicates, three people or an ineligible guardian", () => {
    expect(guardianSetProblem(child, [parent, father])).toBeNull();
    expect(guardianSetProblem(child, [])).toBeNull();
    expect(guardianSetProblem(child, [parent, parent])).toMatch("twice");
    expect(guardianSetProblem(child, [parent, father, { ...father, id: "third" }])).toMatch(
      "at most two"
    );
    expect(guardianSetProblem(child, [parent, { ...father, isMinor: true }])).toMatch(
      "cannot be a guardian"
    );
  });
});
