import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { components } from "../_generated/api";

interface InstalledComponents {
  rateLimiter: ComponentApi<"rateLimiter">;
}

// Runtime component references are generic proxies. The checked-in generated
// declaration cannot gain this member until an explicitly classified target
// runs Convex codegen; the mount contract and registered component test keep
// this narrow bridge honest in the target-neutral implementation stage.
export const rateLimiterComponent = (components as unknown as InstalledComponents).rateLimiter;
