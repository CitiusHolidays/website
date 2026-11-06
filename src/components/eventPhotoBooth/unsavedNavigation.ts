/**
 * Client-side navigation never fires `beforeunload`, so the booth's unsaved-photo prompt would
 * be skipped. While a photo is unsaved, cancel the soft navigation and leave through a document
 * navigation instead; the browser then shows the same prompt a plain anchor always did.
 */
export function leaveUnsavedThroughDocument(
  dirty: boolean,
  href: string,
  assign: (url: string) => void = (url) => window.location.assign(url)
) {
  return (event: { preventDefault: () => void }) => {
    if (!dirty) {
      return;
    }
    event.preventDefault();
    assign(href);
  };
}
