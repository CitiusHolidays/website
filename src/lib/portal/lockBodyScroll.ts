/** Lock page scroll while preserving layout width (scrollbar gutter). */
export function lockBodyScroll(): () => void {
  if (!("document" in globalThis)) {
    return () => undefined;
  }

  const { document } = globalThis;
  const scrollbarWidth = globalThis.innerWidth - document.documentElement.clientWidth;
  const previousOverflow = document.body.style.overflow;
  const previousPaddingRight = document.body.style.paddingRight;

  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  return () => {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  };
}
