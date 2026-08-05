import { AccountHero, AccountLoadingState } from "@/components/account/AccountUi";

export default function AccountLoading() {
  return (
    <div className="min-h-dvh bg-brand-light">
      <AccountHero pastCount={null} upcomingCount={null} user={null} />
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <AccountLoadingState />
      </main>
    </div>
  );
}
