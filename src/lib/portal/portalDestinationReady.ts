type ReadyListener = (href: string) => void;
const listeners = new Set<ReadyListener>();

export function reportPortalDestinationReady(href: string) {
  for (const listener of listeners) {
    listener(href);
  }
}

export function subscribePortalDestinationReady(listener: ReadyListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
