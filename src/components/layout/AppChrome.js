import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import DeferredChatbot from "../ui/DeferredChatbot";
import Footer from "./Footer";
import Header from "./Header";

export default function AppChrome({ children }) {
  return (
    <ReducedMotionProvider>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="relative min-h-0 w-full flex-1">{children}</main>
        <Footer />
        <DeferredChatbot />
      </div>
    </ReducedMotionProvider>
  );
}
