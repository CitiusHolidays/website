export function isStandalonePublicRoute(pathname) {
  const [path] = pathname.split("?");
  return path === "/sacred-bharat" || path.startsWith("/sacred-bharat/");
}
