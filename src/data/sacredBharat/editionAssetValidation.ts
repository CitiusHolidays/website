import { access } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const LEADING_SLASH_PATTERN = /^\//;

interface EditionAsset {
  crop: { height: number; width: number };
  format: string;
}

interface EditionQuestion {
  asset: EditionAsset;
  id: string;
  image: string;
}

interface Edition {
  edition: string;
  questions: readonly EditionQuestion[];
}

export async function validateSacredBharatEditionAssets(
  editions: readonly Edition[],
  publicRoot: string
) {
  const assets = editions.flatMap((edition) =>
    edition.questions.map((question) => ({ edition, question }))
  );
  await Promise.all(
    assets.map(async ({ edition, question }) => {
      const assetPath = join(publicRoot, question.image.replace(LEADING_SLASH_PATTERN, ""));
      await access(assetPath);
      const metadata = await sharp(assetPath).metadata();
      if (
        metadata.format !== question.asset.format ||
        metadata.width !== question.asset.crop.width ||
        metadata.height !== question.asset.crop.height
      ) {
        throw new Error(
          `Sacred Bharat ${edition.edition}/${question.id} asset does not match its crop contract`
        );
      }
    })
  );
}
