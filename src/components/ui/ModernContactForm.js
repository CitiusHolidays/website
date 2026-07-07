"use client";
"use no memo";
import { AlertCircle, FileText, Mail, MessageSquare, Phone, User } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useReducer, useRef } from "react";
import AnimatedSubmitButton from "./AnimatedSubmitButton";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const EMPTY_FORM_VALUES = {
  company: "",
  email: "",
  message: "",
  name: "",
  phone: "",
  subject: "",
};

const INPUT_FIELDS = [
  {
    icon: User,
    label: "Full Name",
    name: "name",
    required: "Full name is required.",
    type: "text",
  },
  {
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

  return nextErrors;
}

const INITIAL_FORM_STATE = {
  buttonState: "idle",
  errors: {},
  focusedField: null,
  formValues: EMPTY_FORM_VALUES,
};

function contactFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": {
      const nextErrors = { ...state.errors };
      delete nextErrors[action.name];
      return {
        ...state,
        errors: nextErrors,
        formValues: { ...state.formValues, [action.name]: action.value },
      };
    }
    case "SET_FOCUSED":
      return { ...state, focusedField: action.field };
    case "SET_ERRORS":
      return {
        ...state,
        buttonState: action.buttonState ?? state.buttonState,
        errors: action.errors,
      };
    case "SET_BUTTON":
      return { ...state, buttonState: action.buttonState };
    case "SUBMIT_SUCCESS":
      return {
        buttonState: "success",
        errors: {},
        focusedField: state.focusedField,
        formValues: EMPTY_FORM_VALUES,
      };
    case "SUBMIT_ERROR":
      return {
        ...state,
        buttonState: "error",
        errors: action.errors,
      };
    default:
      return state;
  }
}

export default function ModernContactForm() {
  "use no memo";

  const [{ formValues, errors, focusedField, buttonState }, dispatch] = useReducer(
    contactFormReducer,
    INITIAL_FORM_STATE
  );
  const turnstileTokenRef = useRef("");
  const formLoadedAtRef = useRef(0);

  const messageRef = useRef(null);

  const handleTurnstileVerify = (token) => {
    turnstileTokenRef.current = token;
  };

  const handleTurnstileExpire = () => {
    turnstileTokenRef.current = "";
  };

  const updateFormValue = (event) => {
    const { name, value } = event.target;
    dispatch({ name, type: "SET_FIELD", value });
  };

  useEffect(() => {
    formLoadedAtRef.current = Date.now();
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = `${messageRef.current.scrollHeight}px`;
    }
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateContactForm(formValues);
    if (Object.keys(validationErrors).length > 0) {
      dispatch({
        buttonState: "error",
        errors: validationErrors,
        type: "SET_ERRORS",
      });
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      return;
    }

    const turnstileToken = turnstileTokenRef.current;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      dispatch({
        buttonState: "error",
        errors: { turnstile: "Please complete the security check before sending." },
        type: "SET_ERRORS",
      });
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      return;
    }

    dispatch({ buttonState: "processing", type: "SET_BUTTON" });
    try {
      const { company, ...fields } = formValues;
      const response = await fetch("/api/contact", {
        body: JSON.stringify({
          ...fields,
          company,
          formLoadedAt: formLoadedAtRef.current,
          turnstileToken: turnstileToken || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (response.ok) {
        dispatch({ type: "SUBMIT_SUCCESS" });
        turnstileTokenRef.current = "";
        formLoadedAtRef.current = Date.now();
        setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 2000);
      } else {
        const errorData = await response.json();
        dispatch({
          errors: { form: errorData.error || "Something went wrong." },
          type: "SET_ERRORS",
        });
        dispatch({ buttonState: "error", type: "SET_BUTTON" });
        setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
      }
    } catch (error) {
      dispatch({
        errors: { form: error.message || "Something went wrong." },
        type: "SET_ERRORS",
      });
      dispatch({ buttonState: "error", type: "SET_BUTTON" });
      setTimeout(() => dispatch({ buttonState: "idle", type: "SET_BUTTON" }), 3000);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <h2 className="mb-2 font-bold text-3xl text-blue-900">Let&apos;s Start a Conversation</h2>
        <p className="text-gray-600">
          Tell us about your travel or event needs, and we&apos;ll craft the perfect solution for
          you.
        </p>
      </div>

      <form className="space-y-6" noValidate onSubmit={onSubmit}>
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

        {INPUT_FIELDS.map((field) => (
          <div className="relative" key={field.name}>
            <m.div
              animate={{
                scale: focusedField === field.name || formValues[field.name] ? 0.8 : 1,
              }}
              className="absolute top-1/2 left-4 z-10 -translate-y-1/2 transform"
              transition={{ duration: 0.2 }}
            >
              <field.icon
                className={`size-5 ${errors[field.name] ? "text-red-500" : "text-gray-400"}`}
              />
            </m.div>

            <m.label
              animate={{
                color: errors[field.name]
                  ? "#EF4444" // red-500
                  : focusedField === field.name
                    ? "#F58220" // Example: orange-500
                    : "#6B7280", // gray-500
                scale: focusedField === field.name || formValues[field.name] ? 0.85 : 1,
                x:
                  focusedField === field.name || formValues[field.name]
                    ? -8 // Adjusted for better positioning
                    : 0,
                y:
                  focusedField === field.name || formValues[field.name]
                    ? -40 // Adjusted for better positioning
                    : 0,
              }}
              className="pointer-events-none absolute top-1/2 left-12 -translate-y-1/2 transform text-gray-500 transition-all duration-200"
              htmlFor={field.name}
              transition={{ duration: 0.2 }}
            >
              {field.label}
            </m.label>

            <input
              aria-invalid={errors[field.name] ? "true" : "false"}
              aria-label={field.label}
              className={`w-full rounded-lg border-2 bg-white px-12 py-4 text-gray-800 transition-all duration-200 focus:outline-none ${
                errors[field.name]
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-300 focus:border-orange-500"
              }`}
              id={field.name}
              name={field.name}
              onBlur={() => dispatch({ field: null, type: "SET_FOCUSED" })}
              onChange={updateFormValue}
              onFocus={() => dispatch({ field: field.name, type: "SET_FOCUSED" })}
              type={field.type}
              value={formValues[field.name]}
            />
            {errors[field.name] && (
              <p className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle size={14} /> {errors[field.name]}
              </p>
            )}
          </div>
        ))}

        <div className="relative">
          <m.div
            animate={{
              scale: focusedField === "message" || formValues.message ? 0.8 : 1,
            }}
            className="absolute top-5 left-4 z-10"
            transition={{ duration: 0.2 }}
          >
            <MessageSquare
              className={`size-5 ${errors.message ? "text-red-500" : "text-gray-400"}`}
            />
          </m.div>

          <m.label
            animate={{
              color: errors.message
                ? "#EF4444"
                : focusedField === "message"
                  ? "#F58220"
                  : "#6B7280",
              scale: focusedField === "message" || formValues.message ? 0.85 : 1,
              x: focusedField === "message" || formValues.message ? -8 : 0,
              y: focusedField === "message" || formValues.message ? -40 : 0,
            }}
            className="pointer-events-none absolute top-5 left-12 text-gray-500 transition-all duration-200"
            htmlFor="message"
            transition={{ duration: 0.2 }}
          >
            Message
          </m.label>

          <textarea
            aria-invalid={errors.message ? "true" : "false"}
            aria-label="Message"
            className={`w-full resize-none rounded-lg border-2 bg-white px-12 py-4 text-gray-800 transition-all duration-200 focus:outline-none ${
              errors.message
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-orange-500"
            }`}
            id="message"
            name="message"
            onBlur={() => dispatch({ field: null, type: "SET_FOCUSED" })}
            onChange={updateFormValue}
            onFocus={() => dispatch({ field: "message", type: "SET_FOCUSED" })}
            onInput={resizeMessageInput}
            ref={messageRef}
            rows={4}
            value={formValues.message}
          />
          {errors.message && (
            <p className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm">
              <AlertCircle size={14} /> {errors.message}
            </p>
          )}
        </div>

        {(errors.form || errors.turnstile) && (
          <p className="mt-1 ml-1 flex items-center gap-1 text-red-500 text-sm">
            <AlertCircle size={14} /> {errors.form || errors.turnstile}
          </p>
        )}

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
