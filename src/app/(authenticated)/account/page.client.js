"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountJourneysPanel } from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountHeader } from "@/components/account/AccountSidebar";
import { AccountHero } from "@/components/account/AccountUi";
import {
  ACCOUNT_JOURNEY_KEY_PATTERN,
  accountUrlFor,
  resolveAccountUrlState,
} from "@/lib/accountUrlState";
import { logout } from "@/lib/auth-client";

const EMPTY_JOURNEYS = Object.freeze({ referenceNow: 0, summaries: [] });
const EMPTY_CONFIRMED_TRIP_PAGE = Object.freeze({ continueCursor: "", isDone: true, page: [] });
const DEFAULT_URL_STATE = Object.freeze({
  journeyKey: null,
  needsCanonicalization: false,
  recovery: null,
  tab: "journeys",
});
const ACCOUNT_JOURNEY_RESTORE_STATE = "accountJourneyRestore";

function readJourneyRestore(state) {
  const restoration = state?.[ACCOUNT_JOURNEY_RESTORE_STATE];
  return restoration &&
    ACCOUNT_JOURNEY_KEY_PATTERN.test(restoration.journeyKey || "") &&
    Number.isFinite(restoration.scrollY) &&
    restoration.scrollY >= 0
    ? { journeyKey: restoration.journeyKey, scrollY: restoration.scrollY }
    : null;
}

function historyStateFor(restoration) {
  return restoration ? { [ACCOUNT_JOURNEY_RESTORE_STATE]: restoration } : null;
}

function splitJourneys(summaries) {
  return summaries.reduce(
    (groups, item) => {
      if (item.category === "cancelled") {
        groups.cancelled.push(item);
      } else if (item.category === "past") {
        groups.past.push(item);
      } else {
        groups.upcoming.push(item);
      }
      return groups;
    },
    { cancelled: [], past: [], upcoming: [] }
  );
}

export default function AccountClient({
  user,
  journeys = EMPTY_JOURNEYS,
  confirmedTripPage = EMPTY_CONFIRMED_TRIP_PAGE,
  initialUrlState = DEFAULT_URL_STATE,
  loadJourneyDetail,
}) {
  const [urlState, setUrlState] = useState(initialUrlState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const journeyRestore = useRef(null);
  const focusOverviewOnReturn = useRef(false);
  const previousJourneyKey = useRef(initialUrlState.journeyKey);
  const tabFocusFrame = useRef(null);
  const groups = splitJourneys(journeys.summaries);
  const activeTab = urlState.tab;

  const navigateAccount = useCallback((nextState, { replace = false, restoration = null } = {}) => {
    const next = {
      journeyKey: nextState.journeyKey || null,
      needsCanonicalization: false,
      recovery: nextState.recovery || null,
      tab: nextState.tab || "journeys",
    };
    window.history[replace ? "replaceState" : "pushState"](
      historyStateFor(restoration),
      "",
      accountUrlFor(next)
    );
    setUrlState(next);
  }, []);

  useEffect(() => {
    const restoreUrlState = () => {
      journeyRestore.current = readJourneyRestore(window.history.state);
      const restored = resolveAccountUrlState(
        new URLSearchParams(window.location.search),
        journeys.summaries
      );
      if (restored.needsCanonicalization) {
        window.history.replaceState(null, "", accountUrlFor(restored));
      }
      setUrlState(restored);
    };
    restoreUrlState();
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, [journeys.summaries]);

  useEffect(() => {
    const previous = previousJourneyKey.current;
    previousJourneyKey.current = urlState.journeyKey;
    if (!(previous && !urlState.journeyKey && urlState.tab === "journeys")) {
      return;
    }
    const restoration = journeyRestore.current;
    const frame = requestAnimationFrame(() => {
      if (urlState.recovery) {
        document.getElementById("account-journey-recovery")?.focus({ preventScroll: true });
        return;
      }
      if (restoration?.journeyKey === previous) {
        window.scrollTo({ behavior: "auto", top: restoration.scrollY });
        document
          .querySelector(`[data-account-journey-key="${previous}"]`)
          ?.focus({ preventScroll: true });
        return;
      }
      if (focusOverviewOnReturn.current) {
        document.getElementById("upcoming-journey-heading")?.focus({ preventScroll: true });
        focusOverviewOnReturn.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [urlState.journeyKey, urlState.recovery, urlState.tab]);

  useEffect(() => {
    if (!urlState.recovery) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById("account-journey-recovery")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [urlState.recovery]);

  useEffect(
    () => () => {
      if (tabFocusFrame.current !== null) {
        cancelAnimationFrame(tabFocusFrame.current);
      }
    },
    []
  );

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = "/";
    } catch {
      setIsLoggingOut(false);
    }
  };

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === urlState.tab && !urlState.journeyKey) {
        return;
      }
      journeyRestore.current = null;
      navigateAccount({ tab });
      if (tabFocusFrame.current !== null) {
        cancelAnimationFrame(tabFocusFrame.current);
      }
      tabFocusFrame.current = requestAnimationFrame(() => {
        document.getElementById("account-main")?.focus({ preventScroll: true });
        tabFocusFrame.current = null;
      });
    },
    [navigateAccount, urlState.journeyKey, urlState.tab]
  );

  const handleJourneyOpen = useCallback(
    (journeyKey) => {
      const restoration = { journeyKey, scrollY: window.scrollY };
      journeyRestore.current = restoration;
      window.history.replaceState(historyStateFor(restoration), "");
      navigateAccount({ journeyKey, tab: "journeys" }, { restoration });
    },
    [navigateAccount]
  );

  const handleJourneyClose = useCallback(() => {
    if (journeyRestore.current?.journeyKey === urlState.journeyKey) {
      window.history.back();
      return;
    }
    focusOverviewOnReturn.current = true;
    navigateAccount({ tab: "journeys" }, { replace: true });
  }, [navigateAccount, urlState.journeyKey]);

  const handleJourneyUnavailable = useCallback(() => {
    journeyRestore.current = null;
    navigateAccount({ recovery: "link-unavailable", tab: "journeys" }, { replace: true });
  }, [navigateAccount]);

  return (
    <div className="account-shell min-h-screen pb-24 md:pb-0">
      <a
        className="account-focus fixed top-3 left-3 z-[100] -translate-y-24 rounded-sm bg-[var(--account-surface)] px-4 py-2 font-semibold text-[var(--account-ink)] shadow-lg transition-transform focus:translate-y-0"
        href="#account-main"
      >
        Skip to main content
      </a>
      <AccountHeader
        activeTab={activeTab}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onTabChange={handleTabChange}
        user={user}
      />
      <div className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <main className="scroll-mt-24 outline-none" id="account-main" tabIndex={-1}>
          {activeTab === "journeys" && <AccountHero user={user} />}
          <AnimatePresence initial={false} mode="sync">
            {activeTab === "journeys" && (
              <AccountJourneysPanel
                cancelledBookings={groups.cancelled}
                confirmedTrips={confirmedTripPage.page}
                confirmedTripsCursor={confirmedTripPage.continueCursor}
                confirmedTripsDone={confirmedTripPage.isDone}
                key="journeys"
                loadJourneyDetail={loadJourneyDetail}
                onJourneyClose={handleJourneyClose}
                onJourneyOpen={handleJourneyOpen}
                onJourneyUnavailable={handleJourneyUnavailable}
                pastBookings={groups.past}
                recovery={urlState.recovery}
                referenceNow={journeys.referenceNow}
                selectedJourneyKey={urlState.journeyKey}
                upcomingBookings={groups.upcoming}
              />
            )}
            {activeTab === "profile" && <AccountProfilePanel key="profile" user={user} />}
            {activeTab === "settings" && <AccountSettingsPanel key="settings" />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
