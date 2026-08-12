import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import DeferredChatbot from "../ui/DeferredChatbot";
import Footer from "./Footer";
import Header from "./Header";

export default function AppChrome({ children }) {
  return (
    <ReducedMotionProvider>
      <div className="relative flex min-h-screen flex-col">
        <a
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-public-surface px-4 py-2 font-semibold text-public-blue shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-public-orange-ink focus:outline-offset-2"
          href="#public-main"
        >
          Skip to main content
        </a>
        <Header />
        <main
          className="relative min-h-0 w-full flex-1 scroll-mt-24 outline-none"
          id="public-main"
          tabIndex={-1}
        >
          {children}
        </main>
        <Footer />
        <DeferredChatbot />
      </div>
    </ReducedMotionProvider>
  );
}
