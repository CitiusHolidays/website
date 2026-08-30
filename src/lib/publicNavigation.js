export function publicRouteCurrent(pathname, href) {
  if (pathname === href) {
    return "page";
  }
  if (href !== "/" && pathname.startsWith(`${href}/`)) {
    return "location";
  }
}
