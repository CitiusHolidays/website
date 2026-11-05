// Adapted React Email component examples; notice in docs/licenses/react-email-components.txt.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
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
  details: "#F5F7FB",
  ink: "#272F3C",
  muted: "#667080",
  page: "#F3F5F8",
};
export const EMAIL_BRAND_LOGO_URL =
  "https://www.citiusholidays.com/images/email/citius-logo-v1.jpg";
const paragraph = { color: colors.ink, fontSize: "15px", lineHeight: "23px", margin: "0 0 12px" };

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
    <Section
      style={{
        backgroundColor: colors.details,
        borderRadius: "8px",
        margin: "20px 0",
        padding: "16px",
      }}
    >
      <Heading
        as="h2"
        style={{ ...paragraph, fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}
      >
        {details.title}
      </Heading>
      <table
        cellPadding="0"
        cellSpacing="0"
        data-text-format="dataTable"
        role="presentation"
        style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}
      >
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  color: colors.muted,
                  fontSize: "13px",
                  lineHeight: "20px",
                  padding: "4px 12px 4px 0",
                  verticalAlign: "top",
                  width: "34%",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  color: colors.ink,
                  fontSize: "14px",
                  lineHeight: "21px",
                  overflowWrap: "anywhere",
                  padding: "4px 0",
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
  const isReply = href.startsWith("mailto:");
  return (
    <Html lang="en">
      <Head>
        <meta content="light" name="color-scheme" />
        <meta content="light" name="supported-color-schemes" />
      </Head>
      <Preview>{`${content.context}: ${content.title}`}</Preview>
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
            margin: "0 auto",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          <Section style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "24px" }}>
            <Section style={{ marginBottom: "28px" }}>
              <Img
                alt="Citius Holidays"
                data-skip-in-text="true"
                height="50"
                src={EMAIL_BRAND_LOGO_URL}
                style={{ backgroundColor: "#FFFFFF", color: colors.blue, fontSize: "14px" }}
                width="140"
              />
            </Section>
            <Section>
              <Heading
                as="h1"
                style={{
                  color: colors.ink,
                  fontSize: "23px",
                  fontWeight: 600,
                  letterSpacing: "-0.4px",
                  lineHeight: "29px",
                  margin: "0 0 16px",
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
                <Section style={{ margin: "20px 0" }}>
                  <Heading
                    as="h2"
                    style={{ ...paragraph, fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}
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
              <Section style={{ marginTop: "22px" }}>
                <Button
                  href={href}
                  style={{
                    backgroundColor: colors.blue,
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 600,
                    lineHeight: "20px",
                    padding: "12px",
                    textAlign: "center",
                    textDecoration: "none",
                    width: "100%",
                  }}
                >
                  {content.action.label}
                </Button>
              </Section>
              {isReply ? null : (
                <Section data-skip-in-text="true" style={{ marginTop: "12px" }}>
                  <Text
                    style={{ color: colors.muted, fontSize: "12px", lineHeight: "18px", margin: 0 }}
                  >
                    Or{" "}
                    <Link href={href} style={{ color: colors.muted, textDecoration: "underline" }}>
                      use the direct link
                    </Link>
                    .
                  </Text>
                </Section>
              )}
            </Section>
          </Section>
          <Section style={{ padding: "20px 24px 8px" }}>
            <Text style={{ color: colors.muted, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
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
