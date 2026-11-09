import AuthShell from "./AuthShell";

const BLOCK = "rounded-xl bg-[#0B1026]/10";

function FieldPlaceholder() {
  return (
    <div>
      <div className="mb-1.5 ml-1 h-5 w-28 rounded bg-[#0B1026]/10" />
      <div className={`h-[3.125rem] ${BLOCK}`} />
    </div>
  );
}

/**
 * Generic sign-in shell streamed while the session check runs. It mirrors the sign-in card's
 * geometry (heading block, Google button, divider, two labelled fields, submit and, for routes
 * with self-service sign-up, the mode switch) so the centred card keeps its size when the form
 * replaces it. It carries no session, callback, user, or destination data.
 */
export default function AuthLoginLoadingShell({ reserveModeSwitch = false } = {}) {
  return (
    <AuthShell>
      <div aria-busy="true">
        <span aria-live="polite" className="sr-only" role="status">
          Checking your secure session
        </span>
        <div className="mb-6">
          <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
            Secure sign in
          </h1>
          <p className="mt-2 text-[#0B1026]/70 leading-6">
            We’re checking for an existing secure session before showing sign in.
          </p>
        </div>
        <div aria-hidden="true">
          <div className={`h-[3.125rem] ${BLOCK}`} />
          <div className="my-5 flex h-5 items-center gap-3">
            <div className="h-px grow bg-[#0B1026]/10" />
            <div className="h-4 w-4 rounded bg-[#0B1026]/10" />
            <div className="h-px grow bg-[#0B1026]/10" />
          </div>
          <div className="space-y-4">
            <FieldPlaceholder />
            <FieldPlaceholder />
            <div className="h-12 rounded-lg bg-[#0B1026]/15" />
          </div>
          {reserveModeSwitch ? (
            <div className="mx-auto mt-6 h-6 w-56 rounded bg-[#0B1026]/10" />
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}
