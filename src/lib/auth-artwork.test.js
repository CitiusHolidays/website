import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const AUTH_ARTWORK_BOOTSTRAP_SCRIPT = readFileSync("public/scripts/auth-artwork.js", "utf8");
const AUTH_ARTWORKS = [
  "/images/auth/hallstatt.webp",
  "/images/auth/positano.webp",
  "/images/auth/lauterbrunnen.webp",
  "/images/auth/pahalgam.webp",
  "/images/auth/munnar.webp",
  "/images/auth/udaipur.webp",
];

function runArtworkBootstrap(storedIndex, randomValues = [0]) {
  const preload = {};
  const style = {};
  const storageWrites = [];
  let randomIndex = 0;
  const context = {
    document: {
      createElement: () => preload,
      documentElement: {
        dataset: {},
        style: {
          setProperty(name, value) {
            style[name] = value;
          },
        },
      },
      head: { append: (element) => expect(element).toBe(preload) },
    },
    Math: {
      floor: Math.floor,
      random() {
        const value = randomValues[randomIndex] ?? 0;
        randomIndex += 1;
        return value;
      },
    },
    sessionStorage: {
      getItem: () => storedIndex,
      setItem: (...write) => storageWrites.push(write),
    },
  };
  runInNewContext(AUTH_ARTWORK_BOOTSTRAP_SCRIPT, context);
  return { context, preload, storageWrites, style };
}

test("selects a different random auth artwork on each page load", () => {
  expect(new Set(AUTH_ARTWORKS).size).toBe(6);

  const random = runArtworkBootstrap(null, [0.7]);
  expect(random.storageWrites).toEqual([["citius-auth-artwork", "4"]]);
  expect(random.preload.href).toBe(AUTH_ARTWORKS[4]);

  const repeat = runArtworkBootstrap("4", [0.7, 0]);
  expect(repeat.storageWrites).toEqual([["citius-auth-artwork", "5"]]);
  expect(repeat.style["--auth-artwork-image"]).toBe(`url("${AUTH_ARTWORKS[5]}")`);
  expect(repeat.context.document.documentElement.dataset.authArtwork).toBe("udaipur");
});
