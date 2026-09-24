export function isStandalonePublicRoute(pathname) {
  const [path] = pathname.split("?");
  return (
    path === "/photo-booth" ||
    path === "/photo-booth/" ||
    path === "/sacred-bharat" ||
    path.startsWith("/sacred-bharat/")
  );
}
