"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SACRED_BHARAT_EDITION_001 } from "@/data/sacredBharat/edition001";
import { deriveEditionResult, getShareStyle, SHARE_STYLES } from "@/lib/sacredBharat/editionResult";
import { createStoryCardBlob } from "@/lib/sacredBharat/storyCard";
import { SacredStoryCard } from "./SacredStoryCard";

const SHARE_IMAGE = "/images/sacred-bharat/001/amritsar.webp";
const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{24}$/;
const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const { questions: EDITION_QUESTIONS } = SACRED_BHARAT_EDITION_001;

function randomToken(byteLength = 12) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getPlayerToken() {
  const storageKey = "sacred-bharat-player-v1";
  const stored = window.localStorage.getItem(storageKey);
  if (stored && PLAYER_TOKEN_PATTERN.test(stored)) {
    return stored;
  }
  const token = randomToken();
  window.localStorage.setItem(storageKey, token);
  return token;
}

function getShareToken() {
  const storageKey = "sacred-bharat-share-v1";
  const stored = window.localStorage.getItem(storageKey);
  if (stored && SHARE_TOKEN_PATTERN.test(stored)) {
    return stored;
  }
  const token = randomToken(16);
  window.localStorage.setItem(storageKey, token);
  return token;
}

async function recordEditionEvent(event, payload = {}) {
  try {
    await fetch("/api/sacred-bharat/events", {
      body: JSON.stringify({
        edition: "001",
        event,
        eventId: randomToken(16),
        playerToken: getPlayerToken(),
        ...payload,
      }),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Analytics must never interrupt the edition.
  }
}

function ChoiceStatus({ isCorrect, isSelected, isSubmitted }) {
  if (!(isSubmitted && (isCorrect || isSelected))) {
    return null;
  }
  if (isCorrect) {
    return <Check aria-label="Correct answer" className="size-4 shrink-0" strokeWidth={2.5} />;
  }
  return <X aria-label="Your answer" className="size-4 shrink-0" strokeWidth={2.5} />;
}

function getSubmittedChoiceClass(choiceIsCorrect, choiceIsSelected) {
  if (choiceIsCorrect) {
    return "border-public-lime bg-public-lime text-public-ink";
  }
  if (choiceIsSelected) {
    return "border-public-orange bg-public-orange-ink text-public-paper";
  }
  return "border-white/10 bg-white/[0.045] text-white/65";
}

function QuestionView({ index, onAnswer, onNext, question, selectedChoice }) {
  const headingRef = useRef(null);
  const isSubmitted = selectedChoice !== null;
  const isCorrect = selectedChoice === question.answer;
  const handleChoice = useCallback(
    (event) => {
      onAnswer(event.currentTarget.value);
    },
    [onAnswer]
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={`sacred-question-${question.id}`}
      className="mx-auto w-full max-w-[31rem]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-public-night shadow-[0_26px_80px_rgb(0_0_0_/_0.34)]">
        <Image
          alt={question.imageAlt}
          className={`object-cover motion-safe:transition-transform motion-safe:duration-700 ${
            isSubmitted ? "scale-100" : "scale-[1.14]"
          }`}
          fill
          priority={index === 0}
          sizes="(max-width: 540px) calc(100vw - 32px), 496px"
          src={question.image}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-public-night/65 via-transparent to-black/5" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
          <span className="font-medium text-xs tracking-wide">Detail {index + 1}</span>
          <a
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/45 px-3 text-[11px] text-white/90 backdrop-blur-sm hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href={question.credit.source}
            rel="noreferrer"
            target="_blank"
          >
            {question.credit.author} · {question.credit.license}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </div>
      </div>

      <div className="mt-7">
        <h1
          className="font-heading text-[clamp(1.7rem,7vw,2.4rem)] text-public-paper leading-[1.04] outline-none"
          id={`sacred-question-${question.id}`}
          ref={headingRef}
          tabIndex={-1}
        >
          {question.prompt}
        </h1>
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {question.choices.map((choice) => {
            const choiceIsCorrect = choice.id === question.answer;
            const choiceIsSelected = choice.id === selectedChoice;
            const submittedClass = getSubmittedChoiceClass(choiceIsCorrect, choiceIsSelected);
            const activeClass =
              "border-white/20 bg-white/[0.07] text-white hover:border-public-orange hover:bg-white/[0.11]";

            return (
              <button
                className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 disabled:cursor-default ${
                  isSubmitted ? submittedClass : activeClass
                }`}
                disabled={isSubmitted}
                key={choice.id}
                onClick={handleChoice}
                type="button"
                value={choice.id}
              >
                <span>{choice.label}</span>
                <ChoiceStatus
                  isCorrect={choiceIsCorrect}
                  isSelected={choiceIsSelected}
                  isSubmitted={isSubmitted}
                />
              </button>
            );
          })}
        </div>
      </div>

      {isSubmitted ? (
        <div
          aria-live="polite"
          className="mt-5 rounded-[1.5rem] border border-white/10 bg-public-paper p-5 text-public-ink shadow-[0_18px_60px_rgb(0_0_0_/_0.2)]"
        >
          <p className="font-semibold text-public-orange-ink text-xs uppercase tracking-[0.17em]">
            {isCorrect ? "Recognised" : `The detail was ${question.reveal}`}
          </p>
          <h2 className="mt-2 font-heading text-2xl">{question.reveal}</h2>
          <p className="mt-2 text-public-muted text-sm leading-6">{question.fact}</p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <a
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-public-blue text-xs underline decoration-public-blue/35 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-public-blue focus-visible:outline-offset-2"
              href={question.factSource}
              rel="noreferrer"
              target="_blank"
            >
              Read the source
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <button
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-public-night px-5 font-semibold text-sm text-white hover:bg-public-blue focus-visible:outline-2 focus-visible:outline-public-blue focus-visible:outline-offset-2"
              onClick={onNext}
              type="button"
            >
              {index === EDITION_QUESTIONS.length - 1 ? "See my result" : "Next detail"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ResultView({ correctness, onRestart }) {
  const headingRef = useRef(null);
  const [shareStyleIndex, setShareStyleIndex] = useState(0);
  const [status, setStatus] = useState("");
  const result = useMemo(() => deriveEditionResult(EDITION_QUESTIONS, correctness), [correctness]);
  const style = getShareStyle(shareStyleIndex);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const getShareUrl = useCallback(() => {
    const url = new URL("/sacred-bharat/001", window.location.origin);
    url.searchParams.set("via", getShareToken());
    return url.toString();
  }, []);

  const createCard = useCallback(
    () => createStoryCardBlob({ imageSource: SHARE_IMAGE, result, style }),
    [result, style]
  );

  const handleDownload = useCallback(async () => {
    setStatus("Creating your Story card…");
    try {
      const blob = await createCard();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `sacred-bharat-001-${style.id}.png`;
      link.href = objectUrl;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setStatus("Story card downloaded.");
      await recordEditionEvent("result_downloaded", { score: result.score, style: style.id });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The Story card could not be downloaded.");
    }
  }, [createCard, result.score, style.id]);

  const handleShare = useCallback(async () => {
    const shareUrl = getShareUrl();
    setStatus("Preparing your edition…");
    try {
      const blob = await createCard();
      const file = new File([blob], `sacred-bharat-001-${style.id}.png`, { type: "image/png" });
      if (navigator.share) {
        const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;
        await navigator.share({
          ...(canShareFile ? { files: [file] } : {}),
          text: `I recognised ${result.score}/${result.total}. How many sacred details will you know?`,
          title: "Sacred Bharat / 001",
          url: shareUrl,
        });
        setStatus("Edition ready to share.");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("Share link copied.");
      }
      await recordEditionEvent("share_clicked", { score: result.score, style: style.id });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("");
      } else {
        setStatus("Sharing was unavailable. You can copy the link instead.");
      }
    }
  }, [createCard, getShareUrl, result.score, result.total, style.id]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setStatus("Share link copied.");
      await recordEditionEvent("share_link_copied", { score: result.score, style: style.id });
    } catch {
      setStatus("The link could not be copied. Please use Share instead.");
    }
  }, [getShareUrl, result.score, style.id]);

  const handleStyleSelect = useCallback((event) => {
    setShareStyleIndex(Number(event.currentTarget.value));
  }, []);

  const handleJourneyClick = useCallback(() => {
    recordEditionEvent("journey_cta_clicked", { score: result.score });
  }, [result.score]);

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      <div className="mx-auto w-full max-w-[22.5rem] [container-type:inline-size]">
        <SacredStoryCard result={result} style={style} />
      </div>

      <div className="lg:pt-8">
        <p className="font-semibold text-public-orange text-xs uppercase tracking-[0.18em]">
          Your Sacred Bharat / 001
        </p>
        <h1
          className="mt-3 font-heading text-[clamp(2.6rem,9vw,5.5rem)] text-public-paper leading-[0.92] outline-none"
          ref={headingRef}
          tabIndex={-1}
        >
          {result.score}/{result.total}
        </h1>
        <h2 className="mt-4 font-heading text-3xl text-white">{result.title}</h2>
        <p className="mt-4 max-w-xl text-base text-white/75 leading-7">{result.insight}</p>
        <p className="mt-2 text-sm text-white/55">{result.detail}</p>

        <fieldset className="mt-8">
          <legend className="font-semibold text-sm text-white">Choose your Story treatment</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {SHARE_STYLES.map((shareStyle, index) => (
              <button
                aria-pressed={shareStyle.id === style.id}
                className={`min-h-12 rounded-xl border px-3 py-2 text-left font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 ${
                  shareStyle.id === style.id
                    ? "border-public-orange bg-public-orange text-public-ink"
                    : "border-white/15 bg-white/[0.05] text-white hover:bg-white/10"
                }`}
                key={shareStyle.id}
                onClick={handleStyleSelect}
                type="button"
                value={index}
              >
                {shareStyle.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-public-orange px-5 font-semibold text-public-ink text-sm hover:bg-public-lime focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
            onClick={handleShare}
            type="button"
          >
            <Share2 aria-hidden="true" className="size-4" />
            Invite a friend
          </button>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 font-semibold text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            onClick={handleDownload}
            type="button"
          >
            <Download aria-hidden="true" className="size-4" />
            Download
          </button>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 font-semibold text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            onClick={handleCopy}
            type="button"
          >
            <Copy aria-hidden="true" className="size-4" />
            Copy link
          </button>
        </div>
        <p aria-live="polite" className="mt-3 min-h-6 text-public-lime text-sm">
          {status}
        </p>

        <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-6">
          <p className="font-semibold text-public-orange text-xs uppercase tracking-[0.16em]">
            Explore it
          </p>
          <h2 className="mt-2 font-heading text-2xl text-white">
            From recognition to a real journey
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/65 leading-6">
            {SACRED_BHARAT_EDITION_001.cta.body}
          </p>
          <Link
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-public-ink text-sm hover:bg-public-paper focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href={SACRED_BHARAT_EDITION_001.cta.href}
            onClick={handleJourneyClick}
          >
            {SACRED_BHARAT_EDITION_001.cta.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <button
          className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-sm text-white/65 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          onClick={onRestart}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try the edition again
        </button>
      </div>
    </section>
  );
}

export default function SacredBharatEdition() {
  const [index, setIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [correctness, setCorrectness] = useState({});
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const referrer = parameters.get("via");
    recordEditionEvent("edition_started", {
      ...(referrer && SHARE_TOKEN_PATTERN.test(referrer) ? { referrerToken: referrer } : {}),
      shareToken: getShareToken(),
    });
  }, []);

  const handleAnswer = useCallback(
    (choiceId) => {
      const question = EDITION_QUESTIONS[index];
      setSelectedChoice(choiceId);
      setCorrectness((current) => ({ ...current, [question.id]: choiceId === question.answer }));
      recordEditionEvent("question_answered", {
        correct: choiceId === question.answer,
        questionId: question.id,
      });
    },
    [index]
  );

  const handleNext = useCallback(() => {
    if (index === EDITION_QUESTIONS.length - 1) {
      setIsComplete(true);
      const finalResult = deriveEditionResult(EDITION_QUESTIONS, correctness);
      recordEditionEvent("edition_completed", { score: finalResult.score });
      return;
    }
    setIndex((current) => current + 1);
    setSelectedChoice(null);
  }, [correctness, index]);

  const handleRestart = useCallback(() => {
    setCorrectness({});
    setIndex(0);
    setIsComplete(false);
    setSelectedChoice(null);
    recordEditionEvent("edition_restarted");
  }, []);

  return (
    <div className="min-h-[100svh] bg-public-night text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 -left-40 size-[32rem] rounded-full bg-sacred-temple/20 blur-3xl" />
        <div className="absolute -right-32 bottom-[-12rem] size-[34rem] rounded-full bg-sacred-monsoon/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-3">
          <p className="font-heading text-public-paper text-sm sm:text-base">
            Sacred Bharat <span className="text-white/35">/ 001</span>
          </p>
          {isComplete ? (
            <span className="font-semibold text-[11px] text-white/45 uppercase tracking-[0.18em]">
              Result
            </span>
          ) : (
            <div
              aria-label={`Question ${index + 1} of ${EDITION_QUESTIONS.length}`}
              aria-valuemax={EDITION_QUESTIONS.length}
              aria-valuemin={1}
              aria-valuenow={index + 1}
              className="flex items-center gap-1.5"
              role="progressbar"
            >
              {EDITION_QUESTIONS.map((question, questionIndex) => (
                <span
                  className={`h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                    questionIndex === index ? "w-7 bg-public-orange" : "w-1.5 bg-white/20"
                  }`}
                  key={question.id}
                />
              ))}
            </div>
          )}
        </header>

        <div className="flex flex-1 items-start py-5 sm:items-center sm:py-8">
          {isComplete ? (
            <ResultView correctness={correctness} onRestart={handleRestart} />
          ) : (
            <QuestionView
              index={index}
              key={EDITION_QUESTIONS[index].id}
              onAnswer={handleAnswer}
              onNext={handleNext}
              question={EDITION_QUESTIONS[index]}
              selectedChoice={selectedChoice}
            />
          )}
        </div>

        <footer className="mt-7 flex items-center justify-between gap-3 border-white/10 border-t pt-4 text-[11px] text-white/40">
          <span>Five visual details · No login</span>
          <Link
            className="min-h-11 content-center font-semibold text-white/55 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href="/"
          >
            by Citius Holidays
          </Link>
        </footer>
      </div>
    </div>
  );
}
