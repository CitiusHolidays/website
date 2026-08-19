import DeferredChatbot from "../ui/DeferredChatbot";
import AppChromeFrame from "./AppChromeFrame";
import Footer from "./Footer";
import Header from "./Header";

export default function AppChrome({ children }) {
  return (
    <AppChromeFrame chatbot={<DeferredChatbot />} footer={<Footer />} header={<Header />}>
      {children}
    </AppChromeFrame>
  );
}
