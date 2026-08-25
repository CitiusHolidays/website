import AuthShell from "./AuthShell";

export default function AuthLoginLoadingShell() {
  return (
    <AuthShell
      description="We’re checking for an existing secure session before showing sign in."
      title="Opening secure sign in"
    >
      <div aria-busy="true" className="space-y-5">
        <span aria-live="polite" className="sr-only" role="status">
          Checking your secure session
        </span>
        <div aria-hidden="true" className="h-12 rounded-xl bg-[#0B1026]/10" />
        <div aria-hidden="true" className="flex items-center gap-3">
          <div className="h-px grow bg-[#0B1026]/10" />
          <div className="h-4 w-8 rounded bg-[#0B1026]/10" />
          <div className="h-px grow bg-[#0B1026]/10" />
        </div>
        <div aria-hidden="true" className="space-y-3">
          <div className="h-12 rounded-xl bg-[#0B1026]/10" />
          <div className="h-12 rounded-xl bg-[#0B1026]/10" />
          <div className="h-12 rounded-lg bg-[#0B1026]/15" />
        </div>
      </div>
    </AuthShell>
  );
}
