import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render, toPlainText } from "@react-email/render";

export interface TransactionalEmailContent {
  action: { href: string; label: string };
  context: string;
  details?: { title: string; rows: Array<{ label: string; value: string }> } | null;
  footer: string;
  greeting?: string;
  message?: { label: string; value: string };
  paragraphs: string[];
  title: string;
}

const colors = {
  blue: "#102A83",
  border: "#E0E5ED",
  ink: "#1D293D",
  muted: "#5D687B",
  orange: "#C76621",
  page: "#F4F6F9",
};
const paragraph = { color: colors.ink, fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" };

const LINE_BREAK = /[\r\n]/;

function emailActionHref(href: string) {
  const url = new URL(href);
  if (
    LINE_BREAK.test(href) ||
    url.username ||
    url.password ||
    !["http:", "https:", "mailto:"].includes(url.protocol) ||
    (url.protocol === "mailto:" &&
      (url.search ||
        url.hash ||
        !url.pathname ||
        LINE_BREAK.test(decodeURIComponent(url.pathname))))
  ) {
    throw new Error("Invalid transactional email action URL");
  }
  return href;
}

function EmailDetails({ details }: Pick<TransactionalEmailContent, "details">) {
  const rows = details?.rows.filter((row) => row.value.trim());
  if (!(details && rows?.length)) {
    return null;
  }
  return (
    <Section style={{ margin: "24px 0" }}>
      <Heading
        as="h2"
        style={{ ...paragraph, fontSize: "14px", fontWeight: 600, margin: "0 0 6px" }}
      >
        {details.title}
      </Heading>
      <table
        cellPadding="0"
        cellSpacing="0"
        role="presentation"
        style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}
      >
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  color: colors.muted,
                  fontSize: "13px",
                  lineHeight: "20px",
                  padding: "10px 12px 10px 0",
                  verticalAlign: "top",
                  width: "34%",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  color: colors.ink,
                  fontSize: "14px",
                  lineHeight: "21px",
                  overflowWrap: "anywhere",
                  padding: "10px 0",
                  verticalAlign: "top",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function CitiusTransactionalEmail(content: TransactionalEmailContent) {
  const href = emailActionHref(content.action.href);
  const fallbackLabel = href.startsWith("mailto:") ? decodeURIComponent(href.slice(7)) : href;
  return (
    <Html lang="en">
      <Head />
      <Preview>{content.title}</Preview>
      <Body
        lang="en"
        style={{
          backgroundColor: colors.page,
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 0,
          padding: "24px 12px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            maxWidth: "600px",
            overflow: "hidden",
            width: "100%",
          }}
        >
          <Section
            style={{ borderBottom: `1px solid ${colors.border}`, padding: "24px 24px 20px" }}
          >
            <Text
              style={{
                color: colors.blue,
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.5px",
                lineHeight: "28px",
                margin: 0,
              }}
            >
              Citius <span style={{ fontWeight: 400 }}>Holidays</span>
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: "12px",
                lineHeight: "18px",
                margin: "5px 0 0",
              }}
            >
              {content.context}
            </Text>
          </Section>
          <Section style={{ padding: "28px 24px 24px" }}>
            <div
              aria-hidden
              style={{
                backgroundColor: colors.orange,
                height: "3px",
                marginBottom: "18px",
                width: "28px",
              }}
            />
            <Heading
              as="h1"
              style={{
                color: colors.blue,
                fontSize: "25px",
                fontWeight: 600,
                letterSpacing: "-0.4px",
                lineHeight: "32px",
                margin: "0 0 20px",
                overflowWrap: "anywhere",
              }}
            >
              {content.title}
            </Heading>
            {content.greeting ? <Text style={paragraph}>Hi {content.greeting},</Text> : null}
            {content.paragraphs.map((text) => (
              <Text
                key={text}
                style={{ ...paragraph, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
              >
                {text}
              </Text>
            ))}
            <EmailDetails details={content.details} />
            {content.message ? (
              <Section style={{ margin: "24px 0" }}>
                <Heading
                  as="h2"
                  style={{ ...paragraph, fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}
                >
                  {content.message.label}
                </Heading>
                <Text
                  style={{
                    ...paragraph,
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {content.message.value}
                </Text>
              </Section>
            ) : null}
            <Section style={{ marginTop: "24px" }}>
              <Button
                href={href}
                style={{
                  backgroundColor: colors.blue,
                  borderRadius: "6px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: "20px",
                  padding: "13px 20px",
                  textDecoration: "none",
                }}
              >
                {content.action.label}
              </Button>
            </Section>
            <Section data-skip-in-text="true" style={{ marginTop: "20px" }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: "12px",
                  lineHeight: "18px",
                  margin: "0 0 4px",
                }}
              >
                If the button does not open, use this link:
              </Text>
              <Link
                href={href}
                style={{
                  color: colors.blue,
                  fontSize: "12px",
                  lineHeight: "18px",
                  overflowWrap: "anywhere",
                  textDecoration: "underline",
                  wordBreak: "break-all",
                }}
              >
                {fallbackLabel}
              </Link>
            </Section>
          </Section>
          <Section style={{ borderTop: `1px solid ${colors.border}`, padding: "18px 24px 20px" }}>
            <Text style={{ color: colors.muted, fontSize: "12px", lineHeight: "19px", margin: 0 }}>
              {content.footer}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderTransactionalEmail(content: TransactionalEmailContent) {
  const html = await render(<CitiusTransactionalEmail {...content} />);
  return {
    html,
    text: toPlainText(html, {
      selectors: [
        { options: { uppercase: false }, selector: "h1" },
        { options: { uppercase: false }, selector: "h2" },
      ],
      wordwrap: 78,
    }),
  };
}
