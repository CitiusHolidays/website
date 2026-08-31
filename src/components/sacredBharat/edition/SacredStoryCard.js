import Image from "next/image";

export function SacredStoryCard({ edition, result, style }) {
  const isFullBleed = style.id === "temple-red";
  const isMonsoon = style.id === "monsoon";
  let resultBlockClass = "mt-[7%]";
  if (isFullBleed) {
    resultBlockClass = "mt-auto pb-[8%]";
  } else if (isMonsoon) {
    resultBlockClass = "mt-[8%]";
  }

  return (
    <div
      aria-label={`${style.label} Story card preview: ${result.score} out of ${result.total}. ${result.title}.`}
      className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] shadow-[0_24px_80px_rgb(0_0_0_/_0.28)]"
      role="img"
      style={{ backgroundColor: style.background, color: style.foreground }}
    >
      {isFullBleed ? (
        <>
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(max-width: 640px) 82vw, 360px"
            src={edition.share.image}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sacred-temple/30 via-sacred-temple/55 to-sacred-temple/95" />
        </>
      ) : null}

      <div className="absolute inset-0 flex flex-col p-[7%]">
        <p className="font-semibold text-[2.5cqw] uppercase tracking-[0.18em]">
          Sacred Bharat / {edition.edition}
        </p>

        {isMonsoon ? (
          <div className="relative mt-[9%] aspect-[1.08] overflow-hidden rounded-[18%]">
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="(max-width: 640px) 70vw, 320px"
              src={edition.share.image}
            />
          </div>
        ) : null}

        {style.id === "archive" ? (
          <div className="mt-[11%]">
            <p
              className="font-bold font-heading text-[18cqw] leading-none"
              style={{ color: style.accent }}
            >
              {result.score}/{result.total}
            </p>
            <p className="mt-[2%] font-heading text-[5.5cqw]">{result.title}</p>
            <div className="relative mt-[8%] aspect-[1.18] overflow-hidden rounded-[5%]">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="(max-width: 640px) 70vw, 320px"
                src={edition.share.image}
              />
            </div>
          </div>
        ) : null}

        <div className={resultBlockClass}>
          {isFullBleed || isMonsoon ? (
            <>
              <p
                className="font-bold font-heading text-[18cqw] leading-none"
                style={{ color: isMonsoon ? style.accent : style.foreground }}
              >
                {result.score}/{result.total}
              </p>
              <p className="mt-[2%] font-heading text-[5.5cqw]">{result.title}</p>
            </>
          ) : null}
          <p className="mt-[5%] max-w-[90%] font-medium text-[3.2cqw] leading-[1.35]">
            {result.insight}
          </p>
        </div>

        <p className="mt-auto text-[2.1cqw] opacity-70">
          by Citius Holidays · Photo: {edition.share.credit}
        </p>
      </div>
    </div>
  );
}
