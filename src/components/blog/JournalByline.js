import Image from "next/image";
import { getAuthorRoleLine, getImageAlt, getPlateImage } from "./journalContent";

/** Who wrote it, in the author's own role. Renders nothing when the story has no author. */
export default function JournalByline({ author, tone = "paper" }) {
  if (!author?.name) {
    return null;
  }
  const roleLine = getAuthorRoleLine(author);
  const portrait = author.image ? getPlateImage(author.image, 96) : null;
  const nameClass = tone === "night" ? "text-white" : "text-public-ink";
  const roleClass = tone === "night" ? "text-white/75" : "text-public-muted";

  return (
    <div className="flex items-center gap-3">
      {portrait ? (
        <Image
          alt={getImageAlt(author.image, author.name)}
          className="size-11 shrink-0 rounded-full object-cover"
          height={44}
          src={portrait.src}
          width={44}
        />
      ) : null}
      <p className="text-sm leading-snug">
        <span className={`block font-semibold ${nameClass}`}>{author.name}</span>
        {roleLine ? <span className={`block ${roleClass}`}>{roleLine}</span> : null}
      </p>
    </div>
  );
}
