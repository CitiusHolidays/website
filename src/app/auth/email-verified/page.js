import Link from "next/link";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";

export const metadata = {
  title: "Email Verified",
  description: "Your Citius Holidays email address has been verified.",
};

export default function EmailVerifiedPage() {
  return (
    <AuthRecoveryLayout
      panelHeading={
        <>
          You&apos;re <span className="italic text-[#d4af37]">verified</span>
        </>
      }
      panelSubtext="Your email is confirmed. Finish setting up secure access to your Citius Holidays account."
      formTitle="Email verified"
      formDescription="Check your inbox for a password setup link to complete your account."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">
            ✓
          </div>
          <p className="text-sm leading-relaxed text-emerald-800">
            Your email address is verified. We&apos;ve sent a separate email with a link to set your password.
            Once your password is set, you can sign in to the staff portal.
          </p>
        </div>

        <Link
          href="/auth"
          className="flex w-full items-center justify-center rounded-xl bg-[#0B1026] px-4 py-4 text-lg font-medium text-white shadow-lg shadow-[#0B1026]/20 transition hover:bg-[#1a2c4e]"
        >
          Go to sign in
        </Link>
      </div>
    </AuthRecoveryLayout>
  );
}
