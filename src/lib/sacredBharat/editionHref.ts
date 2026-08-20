export const SACRED_BHARAT_EDITION_PATH = "/sacred-bharat";

export function sacredBharatEditionHref(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          params.append(key, item);
        }
      }
    } else if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${SACRED_BHARAT_EDITION_PATH}?${query}` : SACRED_BHARAT_EDITION_PATH;
}
