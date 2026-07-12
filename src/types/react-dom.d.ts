declare module "react-dom" {
  import type { Key, ReactNode, ReactPortal } from "react";

  export function createPortal(
    children: ReactNode,
    container: DocumentFragment | Element,
    key?: Key | null
  ): ReactPortal;
}
