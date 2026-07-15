import { Body, Head, Html, Preview } from "@react-email/components";

const colors = {
  blue: "#102A83",
  border: "#D9E0EA",
  ink: "#172033",
  muted: "#5C667A",
  orange: "#C85F0A",
  page: "#F4F6F9",
  white: "#FFFFFF",
};

const cellStyle = {
  borderBottom: `1px solid ${colors.border}`,
  padding: "12px 16px",
  verticalAlign: "top",
};

function DetailRow({ label, value }) {
  if (!value) {
    return null;
  }
  return (
    <tr>
      <td
        style={{
          ...cellStyle,
          color: colors.muted,
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          width: "120px",
        }}
      >
        {label}
      </td>
      <td style={{ ...cellStyle, color: colors.ink, fontSize: "15px", lineHeight: "22px" }}>
        {value}
      </td>
    </tr>
  );
}

export default function ContactFormEmail({ name, email, phone, subject, message, receivedAt }) {
  return (
    <Html>
      <Head />
      <Preview>{`New website enquiry from ${name}`}</Preview>
      <Body
        style={{
          backgroundColor: colors.page,
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 0,
          padding: "24px 12px",
        }}
      >
        <table
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={{
            backgroundColor: colors.white,
            border: `1px solid ${colors.border}`,
            borderCollapse: "collapse",
            margin: "0 auto",
            maxWidth: "640px",
            width: "100%",
          }}
        >
          <tbody>
            <tr>
              <td style={{ backgroundColor: colors.blue, padding: "28px 32px" }}>
                <div
                  style={{
                    color: colors.white,
                    fontSize: "24px",
                    fontWeight: 700,
                    lineHeight: "30px",
                  }}
                >
                  New Contact Form Submission
                </div>
                <div
                  style={{
                    color: "#DDE5FF",
                    fontSize: "14px",
                    lineHeight: "21px",
                    marginTop: "6px",
                  }}
                >
                  A new enquiry was submitted through the Citius Holidays website.
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "24px 24px 8px" }}>
                <table
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  style={{ borderCollapse: "collapse", width: "100%" }}
                >
                  <tbody>
                    <DetailRow label="Name" value={name} />
                    <DetailRow label="Email" value={email} />
                    <DetailRow label="Phone" value={phone} />
                    <DetailRow label="Subject" value={subject} />
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "18px 32px 8px" }}>
                <div
                  style={{
                    color: colors.muted,
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Message
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "0 32px 28px" }}>
                <div
                  style={{
                    borderLeft: `4px solid ${colors.orange}`,
                    color: colors.ink,
                    fontSize: "15px",
                    lineHeight: "24px",
                    overflowWrap: "anywhere",
                    padding: "12px 16px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {message}
                </div>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  color: colors.muted,
                  fontSize: "12px",
                  lineHeight: "18px",
                  padding: "16px 32px 20px",
                }}
              >
                Received on {receivedAt}. Reply to this email to respond directly to {name}.
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
