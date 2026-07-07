import Footer from "@/components/layout/Footer";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import DeferredChatbot from "@/components/ui/DeferredChatbot";

export default function AuthLayout({ children }) {
  return (
    <ReducedMotionProvider>
      <div className="relative flex min-h-screen flex-col">
        <main className="relative min-h-0 w-full flex-1">{children}</main>
        <Footer />
        <DeferredChatbot />
      </div>
    </ReducedMotionProvider>
  );
}
