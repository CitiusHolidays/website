/** Code-owned boundary for Sonner rendering behind application toast façades. */
export type { ExternalToast, ToasterProps } from "sonner";
// biome-ignore lint/performance/noBarrelFile: this file is the intentional third-party import boundary.
export { Toaster, toast, useSonner } from "sonner";
