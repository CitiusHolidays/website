"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { sanitizeAssistantHtml } from "@/lib/sanitizeAssistantHtml";
import { cn } from "@/lib/utils";

const streamdownPlugins = { cjk, code, math, mermaid };

export const MessageResponse = memo(
  ({ className, children, ...props }) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      plugins={streamdownPlugins}
      {...props}
    >
      {typeof children === "string" ? sanitizeAssistantHtml(children) : children}
    </Streamdown>
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children && nextProps.isAnimating === prevProps.isAnimating
);

MessageResponse.displayName = "MessageResponse";
