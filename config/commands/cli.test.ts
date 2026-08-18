import { describe, expect, test } from "bun:test";
import { formatCliHelp, parseCliArguments } from "./cli";

const specification = {
  command: "bun run example",
  description: "Inspect an example without side effects.",
  options: [
    { choices: ["preview", "production"], name: "target", type: "string" },
    { name: "strict", type: "boolean" },
  ],
} as const;

describe("Strict first-party CLI parser", () => {
  test("Parses declared boolean, string, equals, and positional arguments", () => {
    expect(
      parseCliArguments(["--target=preview", "--strict", "--", "git", "diff"], {
        ...specification,
        allowPositionals: true,
      })
    ).toEqual({
      help: false,
      positionals: ["git", "diff"],
      values: { strict: true, target: "preview" },
    });
    expect(
      parseCliArguments(["git", "diff", "--check"], {
        ...specification,
        allowPositionals: true,
      }).positionals
    ).toEqual(["git", "diff", "--check"]);
  });

  test("Help is explicit while unknown, missing, and invalid options fail with choices", () => {
    expect(parseCliArguments(["--help"], specification).help).toBe(true);
    expect(() => parseCliArguments(["--wat"], specification)).toThrow("Unknown flag --wat");
    expect(() => parseCliArguments(["--target"], specification)).toThrow(
      "--target requires a value"
    );
    expect(() => parseCliArguments(["--target", "local"], specification)).toThrow(
      "Valid choices: preview, production"
    );
  });

  test("Formats one safe usage surface with choices and no environment values", () => {
    expect(formatCliHelp(specification)).toBe(
      [
        "Inspect an example without side effects.",
        "Usage: bun run example [options]",
        "Options:",
        "  --target <preview|production>",
        "  --strict",
        "  --help",
      ].join("\n")
    );
  });
});
