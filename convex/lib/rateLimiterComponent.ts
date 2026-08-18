import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { components } from "../_generated/api";

interface InstalledComponents {
  rateLimiter: ComponentApi<"rateLimiter">;
}

// Runtime component references are generic proxies. The checked-in generated
// declaration cannot gain this member until an explicitly classified target
// runs Convex codegen; the mount contract and registered component test keep
// this narrow bridge honest in the target-neutral implementation stage.
// SAFETY: the component is mounted as rateLimiter; generated types catch up on the next target codegen.
// SAFETY: @convex-dev/rate-limiter is installed in convex.config.ts; generated component types lag until codegen.
const installedComponents = components as typeof components & InstalledComponents;

export const rateLimiterComponent = installedComponents.rateLimiter;
