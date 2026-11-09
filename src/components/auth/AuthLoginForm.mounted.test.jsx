import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthLoginForm, AuthOtherSignIn } from "./AuthLoginForm";

const noop = () => undefined;
const COPY = { submitSignIn: "Sign in to Citius", submitSignUp: "Create Citius account" };

const renderForm = ({
  allowSignup = true,
  authPath = "/auth/guest",
  formError = "",
  isLoading = false,
  mode = "signin",
}) =>
  renderToStaticMarkup(
    <AuthLoginForm
      copy={COPY}
      formData={{ email: "", name: "", password: "" }}
      formError={formError}
      formStatusRef={{ current: null }}
      isLoading={isLoading}
      mode={mode}
      onInputChange={noop}
      onSubmit={noop}
      onToggleMode={noop}
      onTogglePassword={noop}
      showPassword={false}
      variant={{ allowSignup, authPath }}
    />
  );

describe("Auth login form", () => {
  test("Labels the submit button for the mode, and for loading over either mode", () => {
    expect(renderForm({ mode: "signin" })).toContain("<span>Sign in to Citius</span>");
    expect(renderForm({ mode: "signup" })).toContain("<span>Create Citius account</span>");
    expect(renderForm({ isLoading: true, mode: "signin" })).toContain("<span>Processing…</span>");
    expect(renderForm({ isLoading: true, mode: "signup" })).toContain("<span>Processing…</span>");
  });

  test("Shows the name field and mode switch only where signup is allowed", () => {
    const signup = renderForm({ mode: "signup" });
    expect(signup).toContain('id="auth-name"');
    expect(signup).toContain("Already have an account?");
    expect(signup).not.toContain("Forgot password?");

    const signin = renderForm({ mode: "signin" });
    expect(signin).not.toContain('id="auth-name"');
    expect(signin).toContain("Don&#x27;t have an account?");
    expect(signin).toContain("Forgot password?");

    const staffOnly = renderForm({ allowSignup: false, mode: "signup" });
    expect(staffOnly).not.toContain('id="auth-name"');
    expect(staffOnly).not.toContain("Already have an account?");
  });

  test("Keeps the error region mounted and only focusable while it holds an error", () => {
    const quiet = renderForm({});
    expect(quiet).toContain('class="sr-only" id="auth-form-error" role="alert"');
    expect(quiet).not.toContain('tabindex="-1"');

    const failed = renderForm({ formError: "Incorrect email or password." });
    expect(failed).toContain('id="auth-form-error" role="alert" tabindex="-1"');
    expect(failed).toContain("Incorrect email or password.");
  });

  test("Keeps the sign-in page the person came from through password recovery", () => {
    expect(renderForm({})).toContain('href="/auth/forgot-password?from=guest"');
    expect(renderForm({ allowSignup: false, authPath: "/auth/connect" })).toContain(
      'href="/auth/forgot-password?from=connect"'
    );
  });

  test("Links staff and guest sign-in to each other, and the vendor page to neither", () => {
    expect(renderToStaticMarkup(<AuthOtherSignIn variantId="employee" />)).toContain(
      'href="/auth/guest"'
    );
    expect(renderToStaticMarkup(<AuthOtherSignIn variantId="guest" />)).toContain(
      'href="/auth/connect"'
    );
    expect(renderToStaticMarkup(<AuthOtherSignIn variantId="vendor" />)).toBe("");
  });
});
