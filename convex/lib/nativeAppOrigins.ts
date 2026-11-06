/**
 * Trusted origins for the installed Citius apps.
 *
 * The native apps (Citius for customers, Citius Connect for staff) complete Better Auth redirects
 * through their own URL schemes. Better Auth always trusts the web `baseURL`, so this list only adds
 * the two app schemes. Development builds (`expo run:ios|android`) use the same schemes, so no
 * environment-dependent origins exist: there is nothing for a deployment to misconfigure, and Expo
 * Go `exp://` origins are deliberately never trusted (the Expo plugin forwards the session cookie to
 * trusted custom-scheme redirects).
 */
export const NATIVE_APP_TRUSTED_ORIGINS: readonly string[] = Object.freeze([
  "citius://",
  "citiusconnect://",
]);
