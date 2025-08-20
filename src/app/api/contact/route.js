import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import ContactFormEmail from "@/emails/ContactFormEmail";

export async function POST(request) {
  const { name, email, phone, subject, message } = await request.json();

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return NextResponse.json(
      { error: "Email service not configured." },
      { status: 500 }
    );
  }

  const trimmedName = (name || "").toString().trim();
  const trimmedEmail = (email || "").toString().trim();
  const trimmedPhone = (phone || "").toString().trim();
  const trimmedSubject = (subject || "").toString().trim().slice(0, 120);
  const trimmedMessage = (message || "").toString().trim();

  if (!trimmedName || !trimmedEmail || !trimmedMessage) {
    return NextResponse.json(
      { error: "Please provide name, email, and message." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  // Phone number validation (optional field, but if provided must be valid international format)
  if (trimmedPhone) {
    const phoneRegex = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return NextResponse.json(
        { error: "Please provide a valid phone number (e.g., +1 555-123-4567)." },
        { status: 400 }
      );
    }
  }

  if (trimmedMessage.length > 5000) {
    return NextResponse.json(
      { error: "Message is too long." },
      { status: 400 }
    );
  }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailHtml = await render(
    <ContactFormEmail
      name={trimmedName}
      email={trimmedEmail}
      phone={trimmedPhone}
      subject={trimmedSubject || "Contact Form Message"}
      message={trimmedMessage}
    />
  );

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `Contact Form Submission: ${trimmedSubject || "Contact Form Message"}`,
    html: emailHtml,
  };

  try {
    await transport.sendMail(mailOptions);
    return NextResponse.json(
      { message: "Email sent successfully!" },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}
