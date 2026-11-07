import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { destinationCover } from "./customerAppCovers";

const BLURHASH = /^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,}$/;

describe("customer app destination covers", () => {
  test("matches a destination by a whole word, whatever the punctuation", () => {
    expect(destinationCover("Bali")?.path).toBe("/images/event-photo-booth/bali.webp");
    expect(destinationCover("Kailash Mansarovar Yatra 2026")?.path).toBe(
      "/gallery/spiritual/golden-kailash.webp"
    );
    expect(destinationCover("Amalfi Coast & Santorini")?.path).toBe(
      "/gallery/account/amalfi-santorini/positano.webp"
    );
    expect(destinationCover("Kuala-Lumpur, Malaysia")?.path).toBe(
      "/images/destinations/kuala-lumpur.webp"
    );
  });

  test("returns null rather than a near miss", () => {
    expect(destinationCover("Jaipur")).toBeNull();
    expect(destinationCover("Goalpara")).toBeNull();
    // Sources too small for a sharp portrait crop are left to the app's own cover.
    expect(destinationCover("Goa")).toBeNull();
    expect(destinationCover("")).toBeNull();
    expect(destinationCover(null)).toBeNull();
  });

  test("every cover is a file the website serves", () => {
    const root = join(import.meta.dir, "../../public");
    for (const destination of [
      "bali",
      "dubai",
      "paris",
      "varanasi",
      "ayodhya",
      "kedarnath",
      "kailash",
      "nepal",
      "amalfi",
      "santorini",
      "japan",
      "kashmir",
      "malaysia",
      "phuket",
      "shillong",
      "sri lanka",
      "bengaluru",
    ]) {
      const cover = destinationCover(destination);
      expect(cover && existsSync(join(root, cover.path))).toBe(true);
      expect(cover?.placeholder).toMatch(BLURHASH);
    }
  });
});
