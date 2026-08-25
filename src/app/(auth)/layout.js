import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";

export default function AuthLayout({ children }) {
  return (
    <ReducedMotionProvider>
      {/* biome-ignore lint/performance/noSyncScripts: choose and preload one auth hero before first paint. */}
      <script src="/scripts/auth-artwork.js" />
      <main className="relative min-h-dvh w-full">{children}</main>
    </ReducedMotionProvider>
  );
}
