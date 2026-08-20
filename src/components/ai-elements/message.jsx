"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { sanitizeAssistantHtml } from "@/lib/sanitizeAssistantHtml";
import { cn } from "@/lib/utils";
import { isRuntimeString } from "../../lib/runtimeValues";

const streamdownPlugins = { cjk, code, math, mermaid };

export const MessageResponse = memo(
  ({ className, children, ...props }) => {
    const content = isRuntimeString(children) ? sanitizeAssistantHtml(children) : children;
    return (
      <Streamdown
        className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
        plugins={streamdownPlugins}
        {...props}
      >
        {content}
      </Streamdown>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children && nextProps.isAnimating === prevProps.isAnimating
);

MessageResponse.displayName = "MessageResponse";
