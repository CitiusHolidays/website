import AppChrome from "@/components/layout/AppChrome";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

export default function PublicLayout({ children }) {
  return (
    <ConvexClientProvider>
      <div className="public-site">
        <AppChrome>{children}</AppChrome>
      </div>
    </ConvexClientProvider>
  );
}
