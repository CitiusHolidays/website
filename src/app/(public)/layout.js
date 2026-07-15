import AppChrome from "@/components/layout/AppChrome";

export default function PublicLayout({ children }) {
  return (
    <div className="public-site">
      <AppChrome>{children}</AppChrome>
    </div>
  );
}
