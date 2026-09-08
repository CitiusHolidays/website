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
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PublicGrain from "@/components/ui/PublicGrain";
import {
  contextualIconMotion,
  PUBLIC_EASE_OUT,
  publicRevealMotion,
  publicStageMotion,
  publicStaggerContainer,
  publicStaggerItem,
} from "@/lib/publicInteractionMotion";
import { sacredBharatEditionHref } from "@/lib/sacredBharat/editionHref";
import { deriveEditionResult, getShareStyle, SHARE_STYLES } from "@/lib/sacredBharat/editionResult";
import { createStoryCardBlob } from "@/lib/sacredBharat/storyCard";
import { SacredStoryCard } from "./SacredStoryCard";

const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{24}$/;
const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

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

function editionEventBody(edition, event, payload = {}) {
  return JSON.stringify({
    edition,
    event,
    eventId: randomToken(16),
    playerToken: getPlayerToken(),
    ...payload,
  });
}

async function recordEditionEvent(edition, event, payload = {}) {
  try {
    await fetch("/api/sacred-bharat/events", {
      body: editionEventBody(edition, event, payload),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Analytics must never interrupt the edition.
  }
}

function recordEditionStart(edition, payload) {
  try {
    navigator.sendBeacon(
      "/api/sacred-bharat/events",
      new Blob([editionEventBody(edition, "edition_started", payload)], {
        type: "application/json",
      })
    );
  } catch {
    // Analytics must never interrupt the edition.
  }
}

function ChoiceStatus({ isCorrect, isSelected, isSubmitted }) {
  const shouldReduceMotion = !!useReducedMotion();
  const iconMotion = contextualIconMotion(shouldReduceMotion);
  const showStatus = isSubmitted && (isCorrect || isSelected);

  return (
    <AnimatePresence initial={false}>
      {showStatus ? (
        <m.span
          animate={iconMotion.animate}
          className="inline-flex size-4 shrink-0 items-center justify-center"
          exit={iconMotion.exit}
          initial={iconMotion.initial}
          key={isCorrect ? "correct" : "selected"}
          transition={iconMotion.transition}
        >
          {isCorrect ? (
            <Check aria-label="Correct answer" className="size-4" strokeWidth={2.5} />
          ) : (
            <X aria-label="Your answer" className="size-4" strokeWidth={2.5} />
          )}
        </m.span>
      ) : null}
    </AnimatePresence>
  );
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

function QuestionView({
  index,
  onAnswer,
  onNext,
  question,
  questionCount,
  selectedChoice,
  shouldReduceMotion,
}) {
  const headingRef = useRef(null);
  const isSubmitted = selectedChoice !== null;
  const isCorrect = selectedChoice === question.answer;
  const revealMotion = publicRevealMotion(shouldReduceMotion);
  const handleChoice = (event) => {
    onAnswer(event.currentTarget.value);
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={`sacred-question-${question.id}`}
      className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-x-8"
    >
      <h1
        className="min-w-0 font-heading text-[clamp(1.5rem,5vw,2.25rem)] text-public-paper leading-tight outline-none md:col-start-2 md:row-start-1"
        id={`sacred-question-${question.id}`}
        ref={headingRef}
        tabIndex={-1}
      >
        {question.prompt}
      </h1>

      <figure className="min-w-0 md:col-start-1 md:row-span-3 md:row-start-1">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[13rem] overflow-hidden rounded-2xl bg-public-night shadow-[0_20px_60px_rgb(0_0_0_/_0.28)] outline outline-white/10 md:max-w-none">
          <Image
            alt={isSubmitted ? question.imageAlt : question.clueAlt}
            className={`object-cover motion-safe:transition-transform motion-safe:duration-700 ${
              isSubmitted ? "scale-100" : "scale-[1.14]"
            }`}
            fill
            priority={index === 0}
            sizes="(min-width: 768px) 320px, 208px"
            src={question.image}
          />
        </div>
        <figcaption className="mt-1 text-center">
          <a
            className="material-floating material-public-night inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl bg-black/45 px-3 py-2 text-white/90 text-xs backdrop-blur-sm hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href={question.credit.source}
            rel="noreferrer"
            target="_blank"
          >
            <span>
              {question.credit.author} · {question.credit.license}
            </span>
            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
          </a>
        </figcaption>
      </figure>

      <div className="grid min-w-0 grid-cols-1 gap-2 md:col-start-2 md:row-start-2 md:self-start min-[24rem]:grid-cols-2">
        {question.choices.map((choice) => {
          const choiceIsCorrect = choice.id === question.answer;
          const choiceIsSelected = choice.id === selectedChoice;
          const submittedClass = getSubmittedChoiceClass(choiceIsCorrect, choiceIsSelected);
          const activeClass =
            "border-white/20 bg-white/[0.07] text-white hover:border-public-orange hover:bg-white/[0.11]";

          return (
            <button
              className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 disabled:cursor-default ${
                isSubmitted ? submittedClass : activeClass
              }`}
              disabled={isSubmitted}
              key={choice.id}
              onClick={handleChoice}
              type="button"
              value={choice.id}
            >
              <span className="min-w-0 break-words">{choice.label}</span>
              <ChoiceStatus
                isCorrect={choiceIsCorrect}
                isSelected={choiceIsSelected}
                isSubmitted={isSubmitted}
              />
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {isSubmitted ? (
          <m.div
            animate={revealMotion.animate}
            aria-live="polite"
            className="min-w-0 rounded-2xl bg-public-paper p-5 text-public-ink shadow-[0_18px_60px_rgb(0_0_0_/_0.2)] md:col-start-2 md:row-start-3"
            exit={revealMotion.exit}
            initial={revealMotion.initial}
            key="reveal"
            transition={revealMotion.transition}
          >
            <p className="font-semibold text-public-orange-ink text-sm">
              {isCorrect ? "Recognised" : "Revealed"}
            </p>
            <h2 className="mt-2 font-heading text-2xl">{question.reveal}</h2>
            <p className="mt-2 text-public-muted text-sm leading-6">{question.fact}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
                {index === questionCount - 1 ? "See my result" : "Next detail"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function ResultView({ correctness, edition, onRestart, shouldReduceMotion }) {
  const headingRef = useRef(null);
  const actionInFlightRef = useRef(null);
  const [shareStyleIndex, setShareStyleIndex] = useState(0);
  const [activeAction, setActiveAction] = useState(null);
  const [status, setStatus] = useState({ message: "", tone: "neutral" });
  const result = deriveEditionResult(edition.questions, correctness);
  const style = getShareStyle(shareStyleIndex);
  const stagger = publicStaggerContainer(shouldReduceMotion);
  const item = publicStaggerItem(shouldReduceMotion);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const getShareUrl = () => {
    const url = new URL(sacredBharatEditionHref(edition.edition), window.location.origin);
    url.searchParams.set("via", getShareToken());
    return url.toString();
  };

  const createCard = () =>
    createStoryCardBlob({
      editionId: edition.edition,
      imageCredit: edition.share.credit,
      imageSource: edition.share.image,
      result,
      style,
    });

  const runResultAction = async (action, pendingMessage, operation) => {
    if (actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = action;
    setActiveAction(action);
    setStatus({ message: pendingMessage, tone: "progress" });
    try {
      await operation();
    } finally {
      actionInFlightRef.current = null;
      setActiveAction(null);
    }
  };

  const handleDownload = () =>
    runResultAction("download", "Creating your Story card for download…", async () => {
      try {
        const blob = await createCard();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.download = `sacred-bharat-${edition.edition}-${style.id}.png`;
          link.href = objectUrl;
          link.click();
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
        setStatus({ message: "Story card downloaded.", tone: "success" });
        recordEditionEvent(edition.edition, "result_downloaded", {
          score: result.score,
          style: style.id,
        });
      } catch {
        setStatus({ message: "Download failed. Try Download again.", tone: "error" });
      }
    });

  const handleShare = () =>
    runResultAction("share", "Preparing your edition to share…", async () => {
      try {
        const shareUrl = getShareUrl();
        const blob = await createCard();
        const file = new File([blob], `sacred-bharat-${edition.edition}-${style.id}.png`, {
          type: "image/png",
        });
        if (navigator.share) {
          const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;
          const shareData = {
            text: `I recognised ${result.score}/${result.total}. How many sacred details will you know?`,
            title: "Sacred Bharat",
            url: shareUrl,
          };
          if (canShareFile) {
            shareData.files = [file];
          }
          await navigator.share(shareData);
          setStatus({ message: "Shared successfully.", tone: "success" });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setStatus({ message: "Share link copied.", tone: "success" });
        }
        recordEditionEvent(edition.edition, "share_clicked", {
          score: result.score,
          style: style.id,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setStatus({ message: "Share cancelled. Your result is still here.", tone: "neutral" });
        } else {
          setStatus({
            message: "Sharing failed. Try Copy link or Download instead.",
            tone: "error",
          });
        }
      }
    });

  const handleCopy = () =>
    runResultAction("copy", "Copying your share link…", async () => {
      try {
        await navigator.clipboard.writeText(getShareUrl());
        setStatus({ message: "Share link copied.", tone: "success" });
        recordEditionEvent(edition.edition, "share_link_copied", {
          score: result.score,
          style: style.id,
        });
      } catch {
        setStatus({
          message: "Copy failed. Try Copy link again or Download your card.",
          tone: "error",
        });
      }
    });

  const handleStyleSelect = (event) => {
    if (actionInFlightRef.current) {
      return;
    }
    setShareStyleIndex(Number(event.currentTarget.value));
  };

  const handleJourneyClick = () => {
    recordEditionEvent(edition.edition, "journey_cta_clicked", { score: result.score });
  };

  return (
    <section className="mx-auto w-full max-w-2xl">
      <m.div animate={stagger.animate} initial={stagger.initial} variants={stagger.variants}>
        <m.div className="flex flex-wrap items-end gap-x-5 gap-y-3" variants={item.variants}>
          <h1
            className="font-heading text-[clamp(3rem,12vw,5.5rem)] text-public-paper leading-none outline-none"
            ref={headingRef}
            tabIndex={-1}
          >
            {result.score}/{result.total}
          </h1>
          <h2 className="font-heading text-3xl text-white">{result.title}</h2>
        </m.div>

        <m.div className="mt-5 flex flex-wrap gap-3" variants={item.variants}>
          <button
            aria-busy={activeAction === "share"}
            aria-describedby="sacred-result-action-status"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-public-orange px-5 py-3 font-semibold text-public-ink text-sm hover:bg-public-lime focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={activeAction !== null}
            onClick={handleShare}
            type="button"
          >
            <Share2 aria-hidden="true" className="size-4" />
            Invite a friend
          </button>
          <button
            aria-busy={activeAction === "download"}
            aria-describedby="sacred-result-action-status"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 py-3 font-semibold text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={activeAction !== null}
            onClick={handleDownload}
            type="button"
          >
            <Download aria-hidden="true" className="size-4" />
            Download
          </button>
          <button
            aria-busy={activeAction === "copy"}
            aria-describedby="sacred-result-action-status"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 py-3 font-semibold text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={activeAction !== null}
            onClick={handleCopy}
            type="button"
          >
            <Copy aria-hidden="true" className="size-4" />
            Copy link
          </button>
        </m.div>
        <p
          aria-atomic="true"
          className={`mt-3 min-h-6 text-sm ${
            status.tone === "error" ? "text-public-orange" : "text-public-lime"
          }`}
          id="sacred-result-action-status"
          role="status"
        >
          {status.message}
        </p>

        <m.div variants={item.variants}>
          <p className="mt-3 max-w-xl text-base text-white/75 leading-7">{result.insight}</p>
          <p className="mt-2 text-sm text-white/55">{result.detail}</p>
        </m.div>

        <m.details className="mt-6 border-white/15 border-t" variants={item.variants}>
          <summary className="min-h-12 cursor-pointer content-center rounded py-3 font-semibold text-sm text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2">
            Story preview and treatment
          </summary>
          <fieldset className="mt-2">
            <legend className="font-semibold text-sm text-white">
              Choose your Story treatment
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SHARE_STYLES.map((shareStyle, index) => (
                <button
                  aria-pressed={shareStyle.id === style.id}
                  className={`min-h-12 rounded-xl border px-3 py-2 text-left font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 ${
                    shareStyle.id === style.id
                      ? "border-public-orange bg-public-orange text-public-ink"
                      : "border-white/15 bg-white/[0.05] text-white hover:bg-white/10"
                  } disabled:cursor-wait disabled:opacity-60`}
                  disabled={activeAction !== null}
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
          <div className="mx-auto my-5 w-full max-w-[18rem] [container-type:inline-size]">
            <SacredStoryCard edition={edition} result={result} style={style} />
          </div>
        </m.details>

        <m.details className="border-white/15 border-y" variants={item.variants}>
          <summary className="min-h-12 cursor-pointer content-center rounded py-3 font-semibold text-sm text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2">
            Your edition recap
          </summary>
          <section aria-labelledby="sacred-result-recap" className="py-4">
            <h2 className="font-heading text-white text-xl" id="sacred-result-recap">
              The five details, in words
            </h2>
            <ol className="mt-5 space-y-4">
              {edition.questions.map((question) => (
                <li key={question.id}>
                  <p className="font-semibold text-sm text-white">
                    {correctness[question.id] ? "Recognised" : "Revealed"}: {question.reveal}
                  </p>
                  <p className="mt-1 text-sm text-white/65 leading-6">{question.fact}</p>
                </li>
              ))}
            </ol>
          </section>
        </m.details>

        <m.div className="mt-6" variants={item.variants}>
          <h2 className="font-heading text-white text-xl">From recognition to a planned route</h2>
          <p className="mt-2 max-w-lg text-sm text-white/65 leading-6">{edition.cta.body}</p>
          <Link
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-public-ink text-sm hover:bg-public-paper focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href={edition.cta.href}
            onClick={handleJourneyClick}
          >
            {edition.cta.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </m.div>

        <m.button
          className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-sm text-white/65 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          onClick={onRestart}
          type="button"
          variants={item.variants}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try the edition again
        </m.button>
      </m.div>
    </section>
  );
}

export default function SacredBharatEdition({ edition }) {
  return (
    <LazyMotion features={domAnimation}>
      <SacredBharatEditionCanvas edition={edition} />
    </LazyMotion>
  );
}

function SacredBharatEditionCanvas({ edition }) {
  const { questions } = edition;
  const shouldReduceMotion = !!useReducedMotion();
  const stageMotion = publicStageMotion(shouldReduceMotion);
  const resultShellMotion = publicStageMotion(true);
  const [index, setIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [correctness, setCorrectness] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const parameters = new URLSearchParams(window.location.search);
    const referrer = parameters.get("via");
    const payload = { shareToken: getShareToken() };
    if (referrer && SHARE_TOKEN_PATTERN.test(referrer)) {
      payload.referrerToken = referrer;
    }
    recordEditionStart(edition.edition, payload);
  }, [edition.edition]);

  const handleAnswer = (choiceId) => {
    const question = questions[index];
    setSelectedChoice(choiceId);
    setCorrectness((current) => ({ ...current, [question.id]: choiceId === question.answer }));
    recordEditionEvent(edition.edition, "question_answered", {
      correct: choiceId === question.answer,
      questionId: question.id,
    });
  };

  const handleNext = () => {
    if (index === questions.length - 1) {
      setIsComplete(true);
      const finalResult = deriveEditionResult(questions, correctness);
      recordEditionEvent(edition.edition, "edition_completed", { score: finalResult.score });
      return;
    }
    setIndex((current) => current + 1);
    setSelectedChoice(null);
  };

  const handleRestart = () => {
    setCorrectness({});
    setIndex(0);
    setIsComplete(false);
    setSelectedChoice(null);
    recordEditionEvent(edition.edition, "edition_restarted");
  };

  const currentQuestion = questions[index];
  const atmosphereSrc = isComplete
    ? edition.share.image
    : (currentQuestion?.image ?? edition.share.image);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-public-night text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <AnimatePresence initial={false}>
          <m.div
            animate={{ opacity: 0.3 }}
            className="absolute inset-0"
            exit={{ opacity: 0, transition: { duration: 0.2, ease: PUBLIC_EASE_OUT } }}
            initial={{ opacity: 0 }}
            key={atmosphereSrc}
            transition={{ duration: 0.28, ease: PUBLIC_EASE_OUT }}
          >
            <Image
              alt=""
              className="object-cover object-center"
              fill
              priority={index === 0}
              sizes="100vw"
              src={atmosphereSrc}
            />
          </m.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-public-night/80" />
        <PublicGrain className="opacity-50" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-3">
          <p className="material-decorative-glass material-public-night rounded-full border border-white/15 bg-black/25 px-4 py-2 font-heading text-public-paper text-sm backdrop-blur-md sm:text-base">
            Sacred Bharat
          </p>
          <AnimatePresence initial={false} mode="wait">
            {isComplete ? (
              <m.span
                animate={{ opacity: 1 }}
                className="material-decorative-glass material-public-night rounded-full border border-white/15 bg-black/25 px-4 py-2 font-semibold text-sm text-white/80 backdrop-blur-md"
                exit={{ opacity: 0, transition: { duration: 0.12, ease: PUBLIC_EASE_OUT } }}
                initial={{ opacity: 0 }}
                key="result-label"
                transition={{ duration: 0.16, ease: PUBLIC_EASE_OUT }}
              >
                Result
              </m.span>
            ) : (
              <m.div
                animate={{ opacity: 1 }}
                aria-label={`Question ${index + 1} of ${questions.length}`}
                aria-valuemax={questions.length}
                aria-valuemin={1}
                aria-valuenow={index + 1}
                className="material-decorative-glass material-public-night flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-md"
                exit={{ opacity: 0, transition: { duration: 0.12, ease: PUBLIC_EASE_OUT } }}
                initial={false}
                key="progress"
                role="progressbar"
                transition={{ duration: 0.16, ease: PUBLIC_EASE_OUT }}
              >
                {questions.map((question, questionIndex) => (
                  <span
                    className={`h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                      questionIndex === index ? "w-7 bg-public-orange" : "w-1.5 bg-white/20"
                    }`}
                    key={question.id}
                  />
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </header>

        <div className="relative flex flex-1 items-start py-5 sm:items-center sm:py-8">
          <AnimatePresence initial={false} mode="wait">
            {isComplete ? (
              <m.div
                animate={resultShellMotion.animate}
                className="w-full"
                exit={resultShellMotion.exit}
                initial={resultShellMotion.initial}
                key="result"
                transition={resultShellMotion.transition}
              >
                <ResultView
                  correctness={correctness}
                  edition={edition}
                  onRestart={handleRestart}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </m.div>
            ) : (
              <m.div
                animate={stageMotion.animate}
                className="w-full"
                exit={stageMotion.exit}
                initial={stageMotion.initial}
                key={currentQuestion.id}
                transition={stageMotion.transition}
              >
                <QuestionView
                  index={index}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  question={currentQuestion}
                  questionCount={questions.length}
                  selectedChoice={selectedChoice}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </m.div>
            )}
          </AnimatePresence>
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
        <details className="mt-2 text-[11px] text-white/40">
          <summary className="min-h-11 cursor-pointer content-center rounded focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2">
            Content record · revision {edition.contentRecord.revision}
          </summary>
          <div className="mb-2 max-w-2xl rounded-xl border border-white/10 bg-white/[0.04] p-3 leading-5">
            <p>Last reviewed {edition.contentRecord.lastReviewedOn}.</p>
            {edition.contentRecord.changes.map((change) => (
              <p key={`${change.date}-${change.summary}`}>
                {change.date}: {change.summary}
              </p>
            ))}
            {edition.contentRecord.corrections.length > 0 ? (
              <div>
                <p>Corrections</p>
                {edition.contentRecord.corrections.map((correction) => (
                  <p key={`${correction.date}-${correction.summary}`}>
                    {correction.date}: {correction.summary}
                  </p>
                ))}
              </div>
            ) : (
              <p>No corrections recorded.</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
