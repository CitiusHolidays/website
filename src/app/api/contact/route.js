import { render } from "@react-email/render";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import validator from "validator";
import ContactFormEmail from "@/emails/ContactFormEmail";

const rateLimitStore = new Map();

export async function POST(request) {
  const ip = request.ip ?? "127.0.0.1";
  const limit = 1; // 1 request
  const windowMs = 2 * 60 * 1000; // 2 minutes

  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];

  const requestsInWindow = userRequests.filter((ts) => now - ts < windowMs);

  if (requestsInWindow.length >= limit) {
    return new Response("You have reached your request limit.", {
      status: 429,
    });
  }

  requestsInWindow.push(now);
  rateLimitStore.set(ip, requestsInWindow);

  const { name, email, subject, message } = await request.json();

  // Validate and sanitize the input
  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  if (!validator.isEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 }
    );
  }

  const sanitizedData = {
    name: validator.escape(name),
    email: validator.normalizeEmail(email),
    subject: validator.escape(subject),
    message: validator.escape(message),
  };

  // const transport = nodemailer.createTransport({
  //   host: "smtp.office365.com",
  //   port: 587,
  //   secure: false,
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASS, // Your Outlook password or App Password
  //   },
  // });

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailHtml = await render(
    <ContactFormEmail
      name={sanitizedData.name}
      email={sanitizedData.email}
      subject={sanitizedData.subject}
      message={sanitizedData.message}
    />
  );

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Email where you want to receive messages
    subject: `Contact Form Submission: ${sanitizedData.subject}`,
    html: emailHtml,
  };

  try {
    await transport.sendMail(mailOptions);
    return NextResponse.json(
      { message: "Email sent successfully!" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
