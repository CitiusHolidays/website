import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import AccountPortalNotice from "./AccountPortalNotice";

describe("Staff Workspace redirect notice", () => {
  test("Tells a login without staff access why it is in the Travel Account", () => {
    const markup = renderToStaticMarkup(<AccountPortalNotice />);
    expect(markup).toContain('role="status"');
    expect(markup).toContain("does not have staff");
    expect(markup).toContain("Travel Account");
  });
});
