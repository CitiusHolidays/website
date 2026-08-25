import AuthShell from "./AuthShell";

export default function AuthRecoveryLayout({ formTitle, formDescription, children }) {
  return (
    <AuthShell description={formDescription} title={formTitle}>
      {children}
    </AuthShell>
  );
}
