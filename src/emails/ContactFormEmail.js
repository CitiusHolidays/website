import { CitiusTransactionalEmail } from "@convex/lib/transactionalEmail";

export default function ContactFormEmail({ name, email, phone, subject, message, receivedAt }) {
  return (
    <CitiusTransactionalEmail
      action={{ href: `mailto:${encodeURIComponent(email)}`, label: "Reply to enquiry" }}
      context="Website enquiry"
      details={{
        rows: [
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Phone", value: phone || "" },
          { label: "Subject", value: subject },
          { label: "Received", value: receivedAt },
        ],
        title: "Enquiry details",
      }}
      footer={`From the Citius Holidays website. Reply to this email to respond to ${name}.`}
      message={{ label: "Message", value: message }}
      paragraphs={[]}
      title="New website enquiry"
    />
  );
}
