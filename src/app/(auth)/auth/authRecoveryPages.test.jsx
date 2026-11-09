import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

let searchParams = new URLSearchParams();
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => searchParams,
}));

mock.module("next/image", () => ({
  default: ({ alt }) => <span aria-label={alt} role="img" />,
}));

const { default: ResetPasswordPage } = await import("./reset-password/page.client.js");
const { default: EmailVerifiedPage } = await import("./email-verified/page.client.js");
const { default: ForgotPasswordPage } = await import("./forgot-password/page.client.js");

const renderWith = (Page, query) => {
  searchParams = new URLSearchParams(query);
  return renderToStaticMarkup(<Page />);
};

describe("Password reset page", () => {
  test("Explains a link without its token and offers a new one for the same sign-in", () => {
    const markup = renderWith(ResetPasswordPage, "from=connect");
    expect(markup).toContain("This reset link is incomplete");
    expect(markup).toContain('href="/auth/forgot-password?from=connect"');
    expect(markup).toContain('href="/auth/connect"');
    expect(markup).not.toContain('id="password"');
  });

  test("Shows the form for a complete link and returns to guest sign-in by default", () => {
    const markup = renderWith(ResetPasswordPage, "token=reset-token");
    expect(markup).not.toContain("This reset link is incomplete");
    expect(markup).toContain('href="/auth/forgot-password?from=guest"');
  });
});

describe("Forgot password page", () => {
  test("Goes back to the sign-in page the person came from", () => {
    expect(renderWith(ForgotPasswordPage, "from=vendor")).toContain('href="/auth/vendor"');
    expect(renderWith(ForgotPasswordPage, "")).toContain('href="/auth/guest"');
  });
});

describe("Email verified page", () => {
  test("Sends travellers to guest sign-in with traveller copy", () => {
    const markup = renderWith(EmailVerifiedPage, "from=guest");
    expect(markup).toContain("You can sign in now");
    expect(markup).toContain('href="/auth/guest"');
    expect(markup).not.toContain("Citius Connect");
  });

  test("Keeps the staff invitation copy for Citius Connect links", () => {
    const markup = renderWith(EmailVerifiedPage, "from=connect");
    expect(markup).toContain("Set your password");
    expect(markup).toContain('href="/auth/connect"');
  });

  test("Sends a signed-in traveller on to their Travel Account", () => {
    const markup = renderWith(EmailVerifiedPage, "from=guest&next=%2Faccount%3Ftab%3Dtrips");
    expect(markup).toContain("Opening your Travel Account");
    expect(markup).not.toContain("You can sign in now");
  });

  test("Ignores a next destination outside the Travel Account", () => {
    for (const next of ["/portal", "https://evil.example/account", "//evil.example"]) {
      const markup = renderWith(EmailVerifiedPage, `from=guest&next=${encodeURIComponent(next)}`);
      expect(markup).toContain("You can sign in now");
      expect(markup).not.toContain("Opening your Travel Account");
    }
  });

  test("Never forwards staff or an expired link", () => {
    expect(renderWith(EmailVerifiedPage, "from=connect&next=%2Faccount")).toContain(
      "Set your password"
    );
    expect(
      renderWith(EmailVerifiedPage, "from=guest&next=%2Faccount&error=TOKEN_EXPIRED")
    ).toContain("This link has expired");
  });

  test("Explains an expired link instead of claiming the email is verified", () => {
    const markup = renderWith(EmailVerifiedPage, "from=guest&error=TOKEN_EXPIRED");
    expect(markup).toContain("This link has expired");
    expect(markup).not.toContain("Email verified");
    expect(markup).not.toContain("You can sign in now");
  });
});
