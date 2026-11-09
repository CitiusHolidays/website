"use client";

import { useSyncExternalStore } from "react";
import { SignInDropdown } from "./HeaderSignInDropdown";
import { HeaderUserMenu } from "./HeaderUserMenu";

const noopUnsubscribe = () => undefined;
const subscribeToHydration = () => noopUnsubscribe;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
}

export function HeaderSessionControl({
  canAccessPortal,
  isPending,
  isScrolled,
  onLogout,
  setUserMenuOpen,
  user,
  userMenuOpen,
  userMenuRef,
}) {
  const hasHydrated = useHasHydrated();
  const canRevealSession = hasHydrated && !isPending;

  return (
    <div
      aria-busy={canRevealSession ? undefined : "true"}
      className="relative hidden h-11 w-[7.5rem] shrink-0 sm:block md:w-[11.5rem]"
      data-header-session-control=""
    >
      {/* Distinct keys keep the placeholder and the revealed control as separate nodes; reusing
          one node moved it from the placeholder box to the control box, a measured layout shift. */}
      {canRevealSession ? (
        <div className="absolute inset-y-0 right-0 flex items-center" key="session">
          {user ? (
            <HeaderUserMenu
              canAccessPortal={canAccessPortal}
              isScrolled={isScrolled}
              onLogout={onLogout}
              setUserMenuOpen={setUserMenuOpen}
              user={user}
              userMenuOpen={userMenuOpen}
              userMenuRef={userMenuRef}
            />
          ) : (
            <SignInDropdown isScrolled={isScrolled} />
          )}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute top-1/2 right-0 h-10 w-[7.75rem] max-w-full -translate-y-1/2 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none"
          data-header-session-placeholder=""
          key="placeholder"
        />
      )}
    </div>
  );
}
