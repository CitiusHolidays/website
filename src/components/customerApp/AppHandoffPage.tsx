"use client";

import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";
import logo from "@/static/logos/logo.webp";
import { type AppHandoffKind, appHandoffUrl, tokenFromHash } from "./appHandoff";

/**
 * The link's hash, read once per page: the effect below clears it from the address bar, so a
 * later read would see nothing. Keyed by path so another handoff page reads only its own link.
 */
let capturedLink: { hash: string; path: string } | null = null;

function linkHash() {
  const { hash, pathname } = window.location;
  if (hash) {
    capturedLink = { hash, path: pathname };
  }
  return capturedLink?.path === pathname ? capturedLink.hash : "";
}

const neverChanges = () => () => undefined;
const notReadOnServer = () => null;

const copy = {
  invite: {
    action: "Open the invite in the app",
    body: "Citius Holidays has invited you to see your trip in the Citius Holidays app. Open this page on your phone, then tap the button.",
    title: "Your trip invite",
  },
  "sign-in": {
    action: "Sign in to the app",
    body: "Open this page on the phone where you have the Citius Holidays app, then tap the button. The link works once.",
    title: "Sign in to Citius Holidays",
  },
} satisfies Record<AppHandoffKind, { action: string; body: string; title: string }>;

const focusOutline =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#204C94]";

export default function AppHandoffPage({ kind }: { kind: AppHandoffKind }) {
  // null on the server and during hydration; the link's hash ("" when absent) once in the browser.
  const hash = useSyncExternalStore<string | null>(neverChanges, linkHash, notReadOnServer);
  const checked = hash !== null;
  const token = hash ? tokenFromHash(hash) : null;
  const href = token ? appHandoffUrl(kind, token) : null;
  useEffect(() => {
    // Drop the token from the address bar and history once it has been read.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const text = copy[kind];
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16 text-[#0B1026]">
      <Image alt="Citius Holidays" className="h-auto w-36" priority src={logo} />
      <h1 className="font-heading font-semibold text-[33px] leading-[1.18] tracking-[-1px]">
        {text.title}
      </h1>
      {checked && !href ? (
        <p className="text-[#535D6E] text-base">
          This link is incomplete or has expired. Ask Citius Holidays to send a new one.
        </p>
      ) : (
        <>
          <p className="text-[#535D6E] text-base">{text.body}</p>
          {href ? (
            <a
              className={`inline-flex min-h-[50px] w-full items-center justify-center rounded-[9px] bg-[#0B1026] px-[25px] py-[14px] font-semibold text-base text-white hover:bg-[#204C94] ${focusOutline}`}
              href={href}
            >
              {text.action}
            </a>
          ) : null}
        </>
      )}
    </main>
  );
}
