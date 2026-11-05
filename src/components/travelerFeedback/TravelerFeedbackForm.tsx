"use client";

import {
  TRAVELER_FEEDBACK_CATEGORIES,
  TRAVELER_MAX_PHOTOS,
  TRAVELER_PHOTO_MAX_BYTES,
} from "@convex/lib/travelerFeedbackValidators";
import { ArrowLeft, ArrowRight, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input, Textarea } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { cn } from "@/lib/utils";
import logo from "@/static/logos/logo.webp";
import FeedbackTripPhoto from "./FeedbackTripPhoto";
import {
  feedbackRequest,
  loadFeedbackForm,
  newResponseToken,
  type PublicFeedbackForm,
  photoReceiptSchema,
} from "./feedbackClient";

type Category = (typeof TRAVELER_FEEDBACK_CATEGORIES)[number]["value"];
const blankComments = {
  food: "",
  hotel: "",
  improvements: "",
  itinerary: "",
  overall: "",
  whatWentWell: "",
};
const feedbackGroups: { key: string; title: string; categories: Category[] }[] = [
  { categories: ["overall"], key: "experience", title: "Your experience" },
  { categories: ["itinerary", "hotel", "food"], key: "details", title: "Journey details" },
  { categories: ["whatWentWell", "improvements"], key: "reflection", title: "Looking back" },
];
const commentPrompts = {
  food: "Meals, restaurants and quality.",
  hotel: "Comfort, rooms and service.",
  improvements: "What would make the next trip better?",
  itinerary: "The places, the pace and time at each stop.",
  overall: "How did the trip feel as a whole?",
  whatWentWell: "What should we keep doing?",
} satisfies Record<Category, string>;
const focusOutline =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#204C94]";
const fieldClass = cn(
  "rounded-[9px] border border-[#7C8794] bg-white px-[15px] py-[13px] text-[#0B1026] text-base placeholder:text-[#535D6E] focus-visible:ring-0",
  focusOutline
);
const primaryActionClass = cn(
  "inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[9px] bg-[#0B1026] px-[25px] py-[14px] font-semibold text-base text-white hover:bg-[#204C94] sm:w-auto",
  focusOutline
);
const headingClass =
  "font-heading font-semibold text-[33px] leading-[1.18] tracking-[-1px] text-balance min-[701px]:text-4xl min-[1001px]:text-[42px] min-[1001px]:leading-[1.16] min-[1001px]:tracking-[-1.4px]";
const layoutClass =
  "grid items-start gap-8 min-[701px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] min-[701px]:gap-11 min-[1200px]:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] min-[1200px]:gap-24";

function PhotoAttachments({ token, responseToken }: { token: string; responseToken: string }) {
  const id = useId();
  const [category, setCategory] = useState<Category>("overall");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);
  const choose = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = TRAVELER_FEEDBACK_CATEGORIES.find((item) => item.value === event.target.value);
    if (option) {
      setCategory(option.value);
    }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > TRAVELER_PHOTO_MAX_BYTES
    ) {
      setError("Choose a JPEG, PNG or WebP photo no larger than 4 MB.");
      errorRef.current?.focus();
      input.value = "";
      return;
    }
    setBusy(true);
    try {
      const receipt = photoReceiptSchema.parse(
        await feedbackRequest(token, "photo", file, {
          "Content-Type": file.type,
          "X-Feedback-Category": category,
          "X-Feedback-Response": responseToken,
          "X-File-Name": encodeURIComponent(file.name),
        })
      );
      setCount(receipt.photoCount);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "The photo could not be uploaded. Try again."
      );
    }
    setBusy(false);
    input.value = "";
  };
  return (
    <section aria-labelledby={`${id}-title`} className="mt-8">
      <h2
        className="font-heading font-semibold text-[21px] leading-snug sm:text-[22px]"
        id={`${id}-title`}
      >
        Add photos (optional)
      </h2>
      <p className="mt-3 text-[#535D6E] text-sm leading-relaxed" id={`${id}-limits`}>
        Up to 8 photos, 4 MB each. JPEG, PNG or WebP.
      </p>
      {count < TRAVELER_MAX_PHOTOS ? (
        <>
          <label className="mt-6 block" htmlFor={`${id}-category`}>
            <span className="mb-2 block font-semibold text-sm">Photo category</span>
            <select
              className={cn(inputVariants({ surface: "staff" }), fieldClass, "h-12")}
              disabled={busy}
              id={`${id}-category`}
              onChange={choose}
              value={category}
            >
              {TRAVELER_FEEDBACK_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label
            className={cn(
              "mt-[22px] flex cursor-pointer flex-col items-center rounded-xl border border-[#7C8794] border-dashed bg-white px-6 py-9 focus-within:outline-2 focus-within:outline-[#204C94] focus-within:outline-offset-4",
              busy && "cursor-wait opacity-60"
            )}
          >
            <UploadCloud
              aria-hidden="true"
              className="mb-5 size-11 text-[#204C94]"
              strokeWidth={1.5}
            />
            <span className="inline-flex min-h-[50px] items-center justify-center rounded-[9px] bg-[#0B1026] px-[25px] py-[14px] font-semibold text-base text-white">
              {busy ? "Uploading photo..." : "Choose a photo"}
            </span>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={`${id}-limits ${id}-privacy`}
              aria-label="Choose a photo"
              className="sr-only"
              disabled={busy}
              onChange={upload}
              type="file"
            />
          </label>
        </>
      ) : null}
      <p className="mt-[18px] text-[#535D6E] text-sm leading-relaxed" id={`${id}-privacy`}>
        Keep passports, contact details and other private documents out of your photos.
      </p>
      <div aria-live="polite" className="mt-4" role="status">
        {count ? <p className="font-medium text-sm">{count} of 8 photos uploaded.</p> : null}
      </div>
      {error ? (
        <p
          className={cn("mt-4 text-red-700 text-sm", focusOutline)}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ResponseForm({ token, form }: { token: string; form: PublicFeedbackForm }) {
  const id = useId();
  const [comments, setComments] = useState(blankComments);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("experience");
  const [responseToken] = useState(newResponseToken);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);
  useEffect(() => {
    if (saved) {
      savedHeadingRef.current?.focus();
    }
  }, [saved]);
  const comment = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setComments((current) => ({ ...current, [event.target.name]: event.target.value }));
  const respondent = (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value);
  const navigateToSection = (key: string) => {
    setActiveSection(key);
    const heading = document.getElementById(`${id}-${key}`);
    heading?.focus();
    heading?.scrollIntoView({ block: "start" });
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!Object.values(comments).some((value) => value.trim())) {
      setError("Add a comment in at least one section.");
      errorRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await feedbackRequest(
        token,
        "submit",
        JSON.stringify({ comments, respondentName: name, responseToken })
      );
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Feedback could not be saved. Your text is still here. Try again."
      );
    }
    setBusy(false);
  };
  return (
    <div className={layoutClass}>
      <aside className="min-w-0 min-[701px]:sticky min-[701px]:top-[30px] min-[701px]:self-start min-[701px]:pt-3">
        <FeedbackTripPhoto />
        {saved ? null : (
          <nav
            aria-label="Feedback sections"
            className="mt-10 hidden border-[#C6C9CC] border-s min-[701px]:grid"
          >
            {feedbackGroups.map((group) => (
              <button
                aria-current={activeSection === group.key ? "location" : undefined}
                className={cn(
                  "-ms-px min-h-11 border-transparent border-s-[3px] py-2 ps-5 text-start text-base transition-colors",
                  activeSection === group.key
                    ? "border-s-[#F08325] font-semibold text-[#204C94]"
                    : "text-[#535D6E] hover:text-[#204C94]",
                  focusOutline
                )}
                key={group.key}
                onClick={() => navigateToSection(group.key)}
                type="button"
              >
                {group.title}
              </button>
            ))}
          </nav>
        )}
      </aside>
      <div className="min-w-0 min-[701px]:pt-3">
        {saved ? (
          <section aria-labelledby={`${id}-saved`}>
            <h1
              className={cn(headingClass, focusOutline)}
              id={`${id}-saved`}
              ref={savedHeadingRef}
              tabIndex={-1}
            >
              Thank you for sharing.
            </h1>
            <p className="mt-[18px] text-[#535D6E] text-base leading-relaxed [overflow-wrap:anywhere]">
              Your feedback for {form.publicTripLabel} has been saved for the Citius team.
            </p>
            <PhotoAttachments responseToken={responseToken} token={token} />
            <p className="mt-8 text-[#535D6E] text-sm">
              You can close this page when you are done.
            </p>
          </section>
        ) : (
          <form aria-busy={busy} aria-describedby={`${id}-guidance`} onSubmit={submit}>
            <header>
              <h1 className={headingClass}>How was your trip?</h1>
              <p
                className="mt-[18px] max-w-[49ch] text-[#535D6E] text-base leading-[1.65] [overflow-wrap:anywhere]"
                id={`${id}-guidance`}
              >
                Share at least one comment about {form.publicTripLabel}. Skip any questions that
                don’t apply.
              </p>
            </header>
            <label className="mt-7 mb-9 block" htmlFor={`${id}-name`}>
              <span className="mb-[9px] block font-semibold text-sm">
                Your name <span className="font-normal text-[#535D6E]">(optional)</span>
              </span>
              <Input
                autoComplete="name"
                className={cn(fieldClass, "h-12")}
                disabled={busy}
                id={`${id}-name`}
                maxLength={120}
                name="respondentName"
                onChange={respondent}
                value={name}
              />
            </label>
            {feedbackGroups.map((group) => (
              <section
                aria-labelledby={`${id}-${group.key}`}
                className="mb-8 border-[#D9DBDD] border-b pb-8"
                key={group.key}
              >
                <h2
                  className={cn(
                    "mb-5 scroll-mt-7 font-heading font-semibold text-[21px] leading-snug tracking-[-0.5px]",
                    focusOutline
                  )}
                  id={`${id}-${group.key}`}
                  tabIndex={-1}
                >
                  {group.title}
                </h2>
                <div className="grid gap-[22px] min-[1001px]:grid-cols-2">
                  {TRAVELER_FEEDBACK_CATEGORIES.map((category) =>
                    group.categories.includes(category.value) ? (
                      <label
                        className={cn(
                          "block min-w-0",
                          (category.value === "overall" || category.value === "itinerary") &&
                            "col-span-full"
                        )}
                        htmlFor={`${id}-${category.value}`}
                        key={category.value}
                      >
                        <span className="mb-[9px] block font-semibold text-sm">
                          {category.label}{" "}
                          <span className="font-normal text-[#535D6E]">(optional)</span>
                        </span>
                        <Textarea
                          className={cn(
                            fieldClass,
                            "w-full resize-y leading-[1.65]",
                            category.value === "overall"
                              ? "min-h-[136px]"
                              : "min-h-28 min-[1001px]:min-h-[146px]"
                          )}
                          disabled={busy}
                          id={`${id}-${category.value}`}
                          maxLength={2000}
                          name={category.value}
                          onChange={comment}
                          placeholder={commentPrompts[category.value]}
                          rows={category.value === "overall" ? 4 : 3}
                          value={comments[category.value]}
                        />
                      </label>
                    ) : null
                  )}
                </div>
              </section>
            ))}
            <p className="mb-[22px] text-[#535D6E] text-sm leading-relaxed">
              Your feedback is shared with the Citius team. Please leave out passports and private
              contact details. Feedback does not sign you up for promotional emails.
            </p>
            {error ? (
              <p
                className={cn("mb-4 text-red-700 text-sm", focusOutline)}
                ref={errorRef}
                role="alert"
                tabIndex={-1}
              >
                {error}
              </p>
            ) : null}
            <Button
              className={primaryActionClass}
              disabled={busy}
              loading={busy}
              type="submit"
              variant="bare"
            >
              {busy ? "Saving feedback..." : "Submit feedback"}
              <ArrowRight aria-hidden="true" className="size-[18px]" />
            </Button>
            <p className="mt-[13px] text-[#535D6E] text-sm leading-relaxed">
              You can add photos after your feedback is saved.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function FeedbackPage({ onRetry }: { onRetry: () => void }) {
  const [token, setToken] = useState("");
  const [form, setForm] = useState<PublicFeedbackForm | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    const value = window.location.hash.slice(1);
    loadFeedbackForm(value)
      .then((result) => {
        if (current) {
          setForm(result);
          setToken(value);
        }
      })
      .catch((failure) => {
        if (current) {
          setError(failure instanceof Error ? failure.message : "This form could not be loaded.");
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, []);
  return (
    <div className="min-h-dvh bg-[#FDFBF7] font-sans text-[#0B1026]">
      <button
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:start-5 focus:top-5 focus:z-10 focus:rounded-md focus:bg-white focus:p-3",
          focusOutline
        )}
        onClick={() => document.getElementById("feedback-content")?.focus()}
        type="button"
      >
        Skip to feedback
      </button>
      <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-5 px-5 py-[17px] min-[701px]:px-7 min-[701px]:py-[26px]">
        <Link
          aria-label="Back to Citius Holidays"
          className={cn("inline-flex min-h-11 items-center", focusOutline)}
          href="/"
          prefetch={false}
        >
          <Image
            alt="Citius Holidays"
            className="h-auto w-[100px] min-[701px]:w-[116px]"
            height={683}
            sizes="116px"
            src={logo}
            width={1920}
          />
        </Link>
        <Link
          className={cn("inline-flex min-h-11 items-center gap-2 text-sm", focusOutline)}
          href="/"
          prefetch={false}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to website
        </Link>
      </header>
      <main
        className="mx-auto mt-3 max-w-[1240px] px-5 pb-12 outline-offset-4 min-[701px]:mt-[25px] min-[701px]:px-7 min-[701px]:pb-20"
        id="feedback-content"
        tabIndex={-1}
      >
        {form && !loading && !error ? (
          <ResponseForm form={form} token={token} />
        ) : (
          <div className="mx-auto max-w-xl pt-2 min-[701px]:pt-6">
            {loading ? (
              <p className="text-[#535D6E] text-base" role="status">
                Loading your feedback form...
              </p>
            ) : null}
            {!loading && error ? (
              <div className="space-y-4">
                <h1 className={headingClass}>Feedback form unavailable</h1>
                <p className="text-[#535D6E] text-base leading-relaxed" role="alert">
                  {error}
                </p>
                <Button className={focusOutline} onClick={onRetry} type="button" variant="outline">
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TravelerFeedbackForm() {
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((current) => current + 1);
  return <FeedbackPage key={attempt} onRetry={retry} />;
}
