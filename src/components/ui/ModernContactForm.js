"use client";
import { AlertCircle, FileText, Mail, MessageSquare, Phone, User } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import {
  formatContactSubmissionError,
  readJsonError,
  withSupportReference,
} from "@/lib/userFacingErrors";
import AnimatedSubmitButton from "./AnimatedSubmitButton";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const EMPTY_FORM_VALUES = {
  company: "",
  consent: false,
  email: "",
  message: "",
  name: "",
  phone: "",
  subject: "",
};

const INPUT_FIELDS = [
  {
    autoComplete: "name",
    icon: User,
    label: "Full Name",
    name: "name",
    required: "Full name is required.",
    type: "text",
  },
  {
    autoComplete: "email",
    icon: Mail,
    label: "Email Address",
    name: "email",
    pattern: {
      message: "Invalid email address",
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
    },
    required: "A valid email is required.",
    type: "email",
  },
  {
    autoComplete: "tel",
    icon: Phone,
    label: "Phone Number",
    name: "phone",
    pattern: {
      message: "Please enter a valid phone number (e.g., +1 555-123-4567)",
      value: /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/,
    },
    required: false,
    type: "tel",
  },
  {
    autoComplete: "off",
    icon: FileText,
    label: "Subject",
    name: "subject",
    required: "Subject is required.",
    type: "text",
  },
];

function resizeMessageInput(event) {
  const textarea = event.target;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function floatingLabelStyle({ error, focused, raised, textarea = false }) {
  const idleTransform = textarea
    ? "translate3d(0, 0, 0) scale(1)"
    : "translate3d(0, -50%, 0) scale(1)";
  const raisedTransform = textarea
    ? "translate3d(-8px, -40px, 0) scale(0.85)"
    : "translate3d(-8px, calc(-50% - 40px), 0) scale(0.85)";
  let color = "#6B7280";
  if (error) {
    color = "#EF4444";
  } else if (focused) {
    color = "#F58220";
  }
  return {
    color,
    transform: raised ? raisedTransform : idleTransform,
    transformOrigin: "left center",
  };
}

function validateContactForm(values) {
  const nextErrors = {};

  for (const field of INPUT_FIELDS) {
    const value = values[field.name]?.trim() || "";
    if (field.required && !value) {
      nextErrors[field.name] = field.required;
    } else if (field.pattern && value && !field.pattern.value.test(value)) {
      nextErrors[field.name] = field.pattern.message;
    }
  }

  if (!values.message.trim()) {
    nextErrors.message = "Message cannot be empty.";
  }
  if (!values.consent) {
    nextErrors.consent = "Please agree to be contacted about this enquiry.";
  }

  return nextErrors;
}

const INITIAL_FORM_STATE = {
  announcement: "",
  buttonState: "idle",
  errors: {},
  focusedField: null,
  formValues: EMPTY_FORM_VALUES,
};

function createInitialFormState(initialValues) {
  return {
    ...INITIAL_FORM_STATE,
    formValues: {
      ...EMPTY_FORM_VALUES,
      message: initialValues?.message || "",
      subject: initialValues?.subject || "",
    },
  };
}

function contactFormReducer(state, action) {
  const reducers = {
    SET_BUTTON: () => ({ ...state, buttonState: action.buttonState }),
    SET_ERRORS: () => ({
      ...state,
      announcement: action.announcement ?? state.announcement,
      buttonState: action.buttonState ?? state.buttonState,
      errors: action.errors,
    }),
    SET_FIELD: () => {
      const nextErrors = { ...state.errors };
      delete nextErrors[action.name];
      return {
        ...state,
        errors: nextErrors,
        formValues: { ...state.formValues, [action.name]: action.value },
      };
    },
    SET_FOCUSED: () => ({ ...state, focusedField: action.field }),
    SUBMIT_ERROR: () => ({
      ...state,
      announcement: action.announcement,
      buttonState: "error",
      errors: action.errors,
    }),
    SUBMIT_SUCCESS: () => ({
      announcement: "Your enquiry was received. Our team will contact you soon.",
      buttonState: "success",
      errors: {},
      focusedField: state.focusedField,
      formValues: EMPTY_FORM_VALUES,
    }),
  };
  const reduce = reducers[action.type];
  if (!reduce) {
    return state;
  }
  return reduce();
}

function useModernContactForm(initialValues) {
  const [{ announcement, formValues, errors, focusedField, buttonState }, dispatch] = useReducer(
    contactFormReducer,
    initialValues,
    createInitialFormState
  );
  const turnstileTokenRef = useRef("");
  const formLoadedAtRef = useRef(0);
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const submissionKeyRef = useRef("");

  const messageRef = useRef(null);

  const handleTurnstileVerify = (token) => {
    turnstileTokenRef.current = token;
  };

  const handleTurnstileExpire = () => {
    turnstileTokenRef.current = "";
  };

  const updateFormValue = (event) => {
    const { checked, name, type, value } = event.target;
    dispatch({ name, type: "SET_FIELD", value: type === "checkbox" ? checked : value });
  };
  const clearFocusedField = () => dispatch({ field: null, type: "SET_FOCUSED" });
  const focusField = (event) => dispatch({ field: event.currentTarget.name, type: "SET_FOCUSED" });

  useEffect(() => {
    formLoadedAtRef.current = Date.now();
    submissionKeyRef.current = crypto.randomUUID();
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = `${messageRef.current.scrollHeight}px`;
    }
  }, []);

  const focusFirstError = (validationErrors) => {
    const firstName = [...INPUT_FIELDS.map((field) => field.name), "message", "consent"].find(
      (name) => validationErrors[name]
    );
    if (firstName) {
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstName)?.focus());
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    const validationErrors = validateContactForm(formValues);
    if (Object.keys(validationErrors).length > 0) {
      dispatch({
        announcement: "Please correct the highlighted fields.",
        buttonState: "error",
        errors: validationErrors,
        type: "SET_ERRORS",
      });
      focusFirstError(validationErrors);
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      return;
    }

    const turnstileToken = turnstileTokenRef.current;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      dispatch({
        announcement: "Please complete the security check before sending.",
        buttonState: "error",
        errors: { turnstile: "Please complete the security check before sending." },
        type: "SET_ERRORS",
      });
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      return;
    }

    submittingRef.current = true;
    dispatch({ buttonState: "processing", type: "SET_BUTTON" });
    try {
      const { company, ...fields } = formValues;
      const response = await fetch("/api/inbound-intents", {
        body: JSON.stringify({
          clientName: fields.name,
          company,
          consent: fields.consent,
          contactEmail: fields.email,
          contactMobile: fields.phone || undefined,
          formLoadedAt: formLoadedAtRef.current,
          notes: `Subject: ${fields.subject}\n\n${fields.message}`,
          source: "Website",
          turnstileToken: turnstileToken || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": submissionKeyRef.current,
        },
        method: "POST",
      });

      if (response.ok) {
        dispatch({ type: "SUBMIT_SUCCESS" });
        turnstileTokenRef.current = "";
        formLoadedAtRef.current = Date.now();
        submissionKeyRef.current = crypto.randomUUID();
        setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 2000);
      } else {
        const message = withSupportReference(
          formatContactSubmissionError({
            message: await readJsonError(response),
            status: response.status,
          }),
          response
        );
        dispatch({ announcement: message, errors: { form: message }, type: "SUBMIT_ERROR" });
        setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      }
    } catch {
      const message = formatContactSubmissionError();
      dispatch({ announcement: message, errors: { form: message }, type: "SUBMIT_ERROR" });
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
    }
    submittingRef.current = false;
  };

  return {
    announcement,
    buttonState,
    clearFocusedField,
    errors,
    focusedField,
    focusField,
    formRef,
    formValues,
    handleTurnstileExpire,
    handleTurnstileVerify,
    messageRef,
    onSubmit,
    updateFormValue,
  };
}

export default function ModernContactForm({ initialValues }) {
  const {
    announcement,
    buttonState,
    clearFocusedField,
    errors,
    focusField,
    focusedField,
    formRef,
    formValues,
    handleTurnstileExpire,
    handleTurnstileVerify,
    messageRef,
    onSubmit,
    updateFormValue,
  } = useModernContactForm(initialValues);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <h2 className="mb-2 font-bold text-3xl text-blue-900">Let&apos;s Start a Conversation</h2>
        <p className="text-gray-600">
          Tell us about your travel or event needs, and we&apos;ll reply with a proposal or next
          steps.
        </p>
      </div>

      <form
        aria-busy={buttonState === "processing"}
        className="space-y-6"
        noValidate
        onSubmit={onSubmit}
        ref={formRef}
      >
        <p aria-live="polite" className="sr-only" role="status">
          {announcement}
        </p>
        {/* Honeypot — hidden from users; bots often fill every field */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] size-0 overflow-hidden opacity-0"
        >
          <label htmlFor="company">Company</label>
          <input
            autoComplete="off"
            id="company"
            name="company"
            onChange={updateFormValue}
            tabIndex={-1}
            type="text"
            value={formValues.company}
          />
        </div>

        {INPUT_FIELDS.map((field) => {
          const focused = focusedField === field.name;
          const raised = focused || Boolean(formValues[field.name]);
          return (
            <div className="relative" key={field.name}>
              <div className="absolute top-1/2 left-4 z-10 -translate-y-1/2 transform">
                <field.icon
                  className={`size-5 ${errors[field.name] ? "text-red-500" : "text-gray-400"}`}
                />
              </div>

              <label
                className="pointer-events-none absolute top-1/2 left-12 text-gray-500 transition-[color,transform] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                htmlFor={field.name}
                style={floatingLabelStyle({
                  error: Boolean(errors[field.name]),
                  focused,
                  raised,
                })}
              >
                {field.label}
              </label>

              <input
                aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                aria-invalid={errors[field.name] ? "true" : "false"}
                aria-label={field.label}
                autoComplete={field.autoComplete}
                className={`w-full rounded-lg border-2 bg-white px-12 py-4 text-gray-800 transition-[border-color,box-shadow] duration-200 focus:outline-none ${
                  errors[field.name]
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-orange-500"
                }`}
                id={field.name}
                name={field.name}
                onBlur={clearFocusedField}
                onChange={updateFormValue}
                onFocus={focusField}
                type={field.type}
                value={formValues[field.name]}
              />
              {errors[field.name] ? (
                <p
                  className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm"
                  id={`${field.name}-error`}
                >
                  <AlertCircle size={14} /> {errors[field.name]}
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="relative">
          <div className="absolute top-5 left-4 z-10">
            <MessageSquare
              className={`size-5 ${errors.message ? "text-red-500" : "text-gray-400"}`}
            />
          </div>

          <label
            className="pointer-events-none absolute top-5 left-12 text-gray-500 transition-[color,transform] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            htmlFor="message"
            style={floatingLabelStyle({
              error: Boolean(errors.message),
              focused: focusedField === "message",
              raised: focusedField === "message" || Boolean(formValues.message),
              textarea: true,
            })}
          >
            Message
          </label>

          <textarea
            aria-describedby={errors.message ? "message-error" : undefined}
            aria-invalid={errors.message ? "true" : "false"}
            aria-label="Message"
            className={`w-full resize-none rounded-lg border-2 bg-white px-12 py-4 text-gray-800 transition-[border-color,box-shadow] duration-200 focus:outline-none ${
              errors.message
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-orange-500"
            }`}
            id="message"
            name="message"
            onBlur={clearFocusedField}
            onChange={updateFormValue}
            onFocus={focusField}
            onInput={resizeMessageInput}
            ref={messageRef}
            rows={4}
            value={formValues.message}
          />
          {errors.message ? (
            <p
              className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm"
              id="message-error"
            >
              <AlertCircle size={14} /> {errors.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-gray-700 text-sm">
            <input
              aria-describedby={errors.consent ? "consent-help consent-error" : "consent-help"}
              aria-invalid={errors.consent ? "true" : "false"}
              checked={formValues.consent}
              className="mt-0.5 size-5 shrink-0 accent-orange-500"
              name="consent"
              onChange={updateFormValue}
              type="checkbox"
            />
            <span id="consent-help">
              I agree that Citius Holidays may contact me about this enquiry.
            </span>
          </label>
          {errors.consent ? (
            <p
              className="mt-1 ml-8 flex items-center gap-1 text-red-500 text-sm"
              id="consent-error"
            >
              <AlertCircle size={14} /> {errors.consent}
            </p>
          ) : null}
        </div>

        {errors.form || errors.turnstile ? (
          <p className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm">
            <AlertCircle size={14} /> {errors.form || errors.turnstile}
          </p>
        ) : null}

        {TURNSTILE_SITE_KEY ? (
          <TurnstileWidget
            onError={handleTurnstileExpire}
            onExpire={handleTurnstileExpire}
            onVerify={handleTurnstileVerify}
            siteKey={TURNSTILE_SITE_KEY}
          />
        ) : null}

        <AnimatedSubmitButton isSubmitting={buttonState === "processing"} state={buttonState} />
      </form>
    </div>
  );
}
