"use client";
import { motion } from "motion/react";
import {
  AlertCircle,
  FileText,
  Mail,
  MessageSquare,
  User,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import AnimatedSubmitButton from "./AnimatedSubmitButton";

export default function ModernContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm({
    // It's good practice to set default values
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [buttonState, setButtonState] = useState("idle");
  
  // Ref for the textarea element for auto-sizing
  const messageRef = useRef(null);

  const watchedValues = watch();
  
  // Destructure the ref and other props from register for the message field
  const { ref: messageFormRef, ...messageRegisterProps } = register("message", { required: "Message cannot be empty." });

  const handleMessageInput = (e) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = messageRef.current.scrollHeight + "px";
    }
  }, []);

  useEffect(() => {
    if (isSubmitting) {
      setButtonState("processing");
    } else if (submissionStatus === "success") {
      setButtonState("success");
      setTimeout(() => setButtonState("idle"), 2000);
    } else if (submissionStatus?.status === "error") {
      setButtonState("error");
      setTimeout(() => setButtonState("idle"), 3000);
    } else {
      setButtonState("idle");
    }
  }, [isSubmitting, submissionStatus]);

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmissionStatus("success");
        reset();
      } else {
        const errorData = await response.json();
        setSubmissionStatus({
          status: "error",
          message: errorData.error || "Something went wrong.",
        });
      }
    } catch (error) {
      setSubmissionStatus({
        status: "error",
        message: error.message || "Something went wrong.",
      });
    }
  };

  const inputFields = [
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
      name: "subject",
      label: "Subject",
      type: "text",
      icon: FileText,
      required: "Subject is required.",
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-blue-900 mb-2">
          Let&apos;s Start a Conversation
        </h2>
        <p className="text-gray-600">
          Tell us about your travel or event needs, and we&apos;ll craft the
          perfect solution for you.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {inputFields.map((field) => (
          <div key={field.name} className="relative">
            <motion.div
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10"
              animate={{
                scale:
                  focusedField === field.name || watchedValues[field.name]
                    ? 0.8
                    : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <field.icon
                className={`w-5 h-5 ${errors[field.name] ? "text-red-500" : "text-gray-400"}`}
              />
            </motion.div>

            <motion.label
              htmlFor={field.name}
              className="absolute left-12 top-1/2 transform -translate-y-1/2 text-gray-500 transition-all duration-200 pointer-events-none"
              animate={{
                y:
                  focusedField === field.name || watchedValues[field.name]
                    ? -40 // Adjusted for better positioning
                    : 0,
                x:
                  focusedField === field.name || watchedValues[field.name]
                    ? -8 // Adjusted for better positioning
                    : 0,
                scale:
                  focusedField === field.name || watchedValues[field.name]
                    ? 0.85
                    : 1,
                color: errors[field.name]
                  ? "#EF4444" // red-500
                  : focusedField === field.name
                  ? "#F58220" // Example: orange-500
                  : "#6B7280", // gray-500
              }}
              transition={{ duration: 0.2 }}
            >
              {field.label}
            </motion.label>

            <input
              type={field.type}
              id={field.name}
              {...register(field.name, {
                required: field.required,
                pattern: field.pattern,
              })}
              onFocus={() => setFocusedField(field.name)}
              onBlur={() => setFocusedField(null)}
              className={`w-full px-12 py-4 text-gray-800 bg-white border-2 rounded-lg focus:outline-none transition-all duration-200 ${
                errors[field.name]
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-300 focus:border-orange-500"
              }`}
              aria-invalid={errors[field.name] ? "true" : "false"}
            />
            {errors[field.name] && (
              <p className="text-red-500 text-sm mt-1 ml-1 flex items-center gap-1">
                <AlertCircle size={14} /> {errors[field.name].message}
              </p>
            )}
          </div>
        ))}

        <div className="relative">
          <motion.div
            className="absolute left-4 top-5 z-10"
            animate={{
              scale:
                focusedField === "message" || watchedValues.message ? 0.8 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <MessageSquare
              className={`w-5 h-5 ${errors.message ? "text-red-500" : "text-gray-400"}`}
            />
          </motion.div>

          <motion.label
            htmlFor="message"
            className="absolute left-12 top-5 text-gray-500 transition-all duration-200 pointer-events-none"
            animate={{
              y: focusedField === "message" || watchedValues.message ? -40 : 0,
              x: focusedField === "message" || watchedValues.message ? -8 : 0,
              scale:
                focusedField === "message" || watchedValues.message ? 0.85 : 1,
              color: errors.message
                ? "#EF4444"
                : focusedField === "message"
                ? "#F58220"
                : "#6B7280",
            }}
            transition={{ duration: 0.2 }}
          >
            Message
          </motion.label>
          
          <textarea
            id="message"
            {...messageRegisterProps} // Use the rest of the props from register
            ref={(e) => {
              // This callback assigns the element to both refs
              messageFormRef(e); // The ref from React Hook Form
              messageRef.current = e; // Your local ref for auto-sizing
            }}
            onFocus={() => setFocusedField("message")}
            onBlur={() => setFocusedField(null)}
            onInput={handleMessageInput}
            rows={4}
            className={`w-full px-12 py-4 text-gray-800 bg-white border-2 rounded-lg focus:outline-none transition-all duration-200 resize-none ${
              errors.message
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-orange-500"
            }`}
            aria-invalid={errors.message ? "true" : "false"}
          />
          {errors.message && (
            <p className="text-red-500 text-sm mt-1 ml-1 flex items-center gap-1">
              <AlertCircle size={14} /> {errors.message.message}
            </p>
          )}
        </div>

        <AnimatedSubmitButton state={buttonState} isSubmitting={isSubmitting} />
      </form>
    </div>
  );
}
