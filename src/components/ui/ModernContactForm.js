"use client";
"use no memo";
import { m } from "motion/react";
import { AlertCircle, FileText, Mail, MessageSquare, Phone, User } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import AnimatedSubmitButton from "./AnimatedSubmitButton";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const EMPTY_FORM_VALUES = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  company: "",
};

const INPUT_FIELDS = [
  {
    name: "name",
    label: "Full Name",
    type: "text",
    icon: User,
    required: "Full name is required.",
  },
  {
    name: "email",
    label: "Email Address",
    type: "email",
    icon: Mail,
    required: "A valid email is required.",
    pattern: {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: "Invalid email address",
    },
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "tel",
    required: false,
    icon: Phone,
    pattern: {
      value: /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/,
      message: "Please enter a valid phone number (e.g., +1 555-123-4567)",
    },
  },
  {
    name: "subject",
    label: "Subject",
    type: "text",
    icon: FileText,
    required: "Subject is required.",
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
  formValues: EMPTY_FORM_VALUES,
  errors: {},
  focusedField: null,
  buttonState: "idle",
};

function contactFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": {
      const nextErrors = { ...state.errors };
      delete nextErrors[action.name];
      return {
        ...state,
        formValues: { ...state.formValues, [action.name]: action.value },
        errors: nextErrors,
      };
    }
    case "SET_FOCUSED":
      return { ...state, focusedField: action.field };
    case "SET_ERRORS":
      return {
        ...state,
        errors: action.errors,
        buttonState: action.buttonState ?? state.buttonState,
      };
    case "SET_BUTTON":
      return { ...state, buttonState: action.buttonState };
    case "SUBMIT_SUCCESS":
      return {
        formValues: EMPTY_FORM_VALUES,
        errors: {},
        focusedField: state.focusedField,
        buttonState: "success",
      };
    case "SUBMIT_ERROR":
      return {
        ...state,
        errors: action.errors,
        buttonState: "error",
      };
    default:
      return state;
  }
}

export default function ModernContactForm() {
  "use no memo";

  const [{ formValues, errors, focusedField, buttonState }, dispatch] = useReducer(
    contactFormReducer,
    INITIAL_FORM_STATE,
  );
  const turnstileTokenRef = useRef("");
  const [initialFormLoadedAt] = useState(() => Date.now());
  const formLoadedAtRef = useRef(initialFormLoadedAt);

  const messageRef = useRef(null);

  const handleTurnstileVerify = (token) => {
    turnstileTokenRef.current = token;
  };

  const handleTurnstileExpire = () => {
    turnstileTokenRef.current = "";
  };

  const updateFormValue = (event) => {
    const { name, value } = event.target;
    dispatch({ type: "SET_FIELD", name, value });
  };

  useEffect(() => {
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
        type: "SET_ERRORS",
        errors: validationErrors,
        buttonState: "error",
      });
      setTimeout(() => dispatch({ type: "SET_BUTTON", buttonState: "idle" }), 3000);
      return;
    }

    const turnstileToken = turnstileTokenRef.current;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      dispatch({
        type: "SET_ERRORS",
        errors: { turnstile: "Please complete the security check before sending." },
        buttonState: "error",
      });
      setTimeout(() => dispatch({ type: "SET_BUTTON", buttonState: "idle" }), 3000);
      return;
    }

    dispatch({ type: "SET_BUTTON", buttonState: "processing" });
    try {
      const { company, ...fields } = formValues;
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...fields,
          company,
          formLoadedAt: formLoadedAtRef.current,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      if (response.ok) {
        dispatch({ type: "SUBMIT_SUCCESS" });
        turnstileTokenRef.current = "";
        formLoadedAtRef.current = Date.now();
        setTimeout(() => dispatch({ type: "SET_BUTTON", buttonState: "idle" }), 2000);
      } else {
        const errorData = await response.json();
        dispatch({
          type: "SET_ERRORS",
          errors: { form: errorData.error || "Something went wrong." },
        });
        dispatch({ type: "SET_BUTTON", buttonState: "error" });
        setTimeout(() => dispatch({ type: "SET_BUTTON", buttonState: "idle" }), 3000);
      }
    } catch (error) {
      dispatch({
        type: "SET_ERRORS",
        errors: { form: error.message || "Something went wrong." },
      });
      dispatch({ type: "SET_BUTTON", buttonState: "error" });
      setTimeout(() => dispatch({ type: "SET_BUTTON", buttonState: "idle" }), 3000);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-blue-900 mb-2">Let&apos;s Start a Conversation</h2>
        <p className="text-gray-600">
          Tell us about your travel or event needs, and we&apos;ll craft the perfect solution for
          you.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Honeypot — hidden from users; bots often fill every field */}
        <div
          className="absolute -left-[9999px] size-0 overflow-hidden opacity-0"
          aria-hidden="true"
        >
          <label htmlFor="company">Company</label>
          <input
            type="text"
            id="company"
            tabIndex={-1}
            autoComplete="off"
            name="company"
            value={formValues.company}
            onChange={updateFormValue}
          />
        </div>

        {INPUT_FIELDS.map((field) => (
          <div key={field.name} className="relative">
            <m.div
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10"
              animate={{
                scale: focusedField === field.name || formValues[field.name] ? 0.8 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <field.icon
                className={`size-5 ${errors[field.name] ? "text-red-500" : "text-gray-400"}`}
              />
            </m.div>

            <m.label
              htmlFor={field.name}
              className="absolute left-12 top-1/2 transform -translate-y-1/2 text-gray-500 transition-all duration-200 pointer-events-none"
              animate={{
                y:
                  focusedField === field.name || formValues[field.name]
                    ? -40 // Adjusted for better positioning
                    : 0,
                x:
                  focusedField === field.name || formValues[field.name]
                    ? -8 // Adjusted for better positioning
                    : 0,
                scale: focusedField === field.name || formValues[field.name] ? 0.85 : 1,
                color: errors[field.name]
                  ? "#EF4444" // red-500
                  : focusedField === field.name
                    ? "#F58220" // Example: orange-500
                    : "#6B7280", // gray-500
              }}
              transition={{ duration: 0.2 }}
            >
              {field.label}
            </m.label>

            <input
              type={field.type}
              id={field.name}
              name={field.name}
              value={formValues[field.name]}
              onChange={updateFormValue}
              onFocus={() => dispatch({ type: "SET_FOCUSED", field: field.name })}
              onBlur={() => dispatch({ type: "SET_FOCUSED", field: null })}
              className={`w-full px-12 py-4 text-gray-800 bg-white border-2 rounded-lg focus:outline-none transition-all duration-200 ${
                errors[field.name]
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-300 focus:border-orange-500"
              }`}
              aria-invalid={errors[field.name] ? "true" : "false"}
              aria-label={field.label}
            />
            {errors[field.name] && (
              <p className="text-red-500 text-sm mt-1 ml-1 flex items-center gap-1">
                <AlertCircle size={14} /> {errors[field.name]}
              </p>
            )}
          </div>
        ))}

        <div className="relative">
          <m.div
            className="absolute left-4 top-5 z-10"
            animate={{
              scale: focusedField === "message" || formValues.message ? 0.8 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <MessageSquare
              className={`size-5 ${errors.message ? "text-red-500" : "text-gray-400"}`}
            />
          </m.div>

          <m.label
            htmlFor="message"
            className="absolute left-12 top-5 text-gray-500 transition-all duration-200 pointer-events-none"
            animate={{
              y: focusedField === "message" || formValues.message ? -40 : 0,
              x: focusedField === "message" || formValues.message ? -8 : 0,
              scale: focusedField === "message" || formValues.message ? 0.85 : 1,
              color: errors.message
                ? "#EF4444"
                : focusedField === "message"
                  ? "#F58220"
                  : "#6B7280",
            }}
            transition={{ duration: 0.2 }}
          >
            Message
          </m.label>

          <textarea
            id="message"
            ref={messageRef}
            name="message"
            value={formValues.message}
            onChange={updateFormValue}
            onFocus={() => dispatch({ type: "SET_FOCUSED", field: "message" })}
            onBlur={() => dispatch({ type: "SET_FOCUSED", field: null })}
            onInput={resizeMessageInput}
            rows={4}
            className={`w-full px-12 py-4 text-gray-800 bg-white border-2 rounded-lg focus:outline-none transition-all duration-200 resize-none ${
              errors.message
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-orange-500"
            }`}
            aria-invalid={errors.message ? "true" : "false"}
            aria-label="Message"
          />
          {errors.message && (
            <p className="text-red-500 text-sm mt-1 ml-1 flex items-center gap-1">
              <AlertCircle size={14} /> {errors.message}
            </p>
          )}
        </div>

        {(errors.form || errors.turnstile) && (
          <p className="text-red-500 text-sm mt-1 ml-1 flex items-center gap-1">
            <AlertCircle size={14} /> {errors.form || errors.turnstile}
          </p>
        )}

        {TURNSTILE_SITE_KEY ? (
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onVerify={handleTurnstileVerify}
            onExpire={handleTurnstileExpire}
            onError={handleTurnstileExpire}
          />
        ) : null}

        <AnimatedSubmitButton state={buttonState} isSubmitting={buttonState === "processing"} />
      </form>
    </div>
  );
}
