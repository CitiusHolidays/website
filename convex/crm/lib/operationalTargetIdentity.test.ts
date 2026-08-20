import { afterEach, describe, expect, test } from "bun:test";
import {
  assertOperationalTargetIdentity,
  operationalTargetIdentity,
} from "./operationalTargetIdentity";

const original = {
  deployment: process.env.OPERATIONAL_CONTROL_TARGET_ID,
  environment: process.env.VERCEL_ENV,
  revision: process.env.OPERATIONAL_CONTROL_SOURCE_REVISION,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restore("OPERATIONAL_CONTROL_TARGET_ID", original.deployment);
  restore("VERCEL_ENV", original.environment);
  restore("OPERATIONAL_CONTROL_SOURCE_REVISION", original.revision);
});

describe("operational target identity", () => {
  test("fails closed when any exact target value is unavailable", () => {
    process.env.OPERATIONAL_CONTROL_TARGET_ID = "preview:control-check";
    process.env.VERCEL_ENV = "preview";
    delete process.env.OPERATIONAL_CONTROL_SOURCE_REVISION;

    expect(() => operationalTargetIdentity()).toThrow(
      "OPERATIONAL_CONTROL_TARGET_IDENTITY_UNAVAILABLE"
    );
  });

  test("returns trimmed configured identity and rejects a reviewed-target mismatch", () => {
    process.env.OPERATIONAL_CONTROL_TARGET_ID = " preview:control-check ";
    process.env.VERCEL_ENV = "preview";
    process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = " abc1234 ";

    expect(operationalTargetIdentity()).toEqual({
      targetDeployment: "preview:control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
    });
    expect(() =>
      assertOperationalTargetIdentity({
        expectedTargetDeployment: "preview:control-check",
        expectedTargetEnvironment: "preview",
        expectedTargetRevision: "different-revision",
      })
    ).toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
  });
});
