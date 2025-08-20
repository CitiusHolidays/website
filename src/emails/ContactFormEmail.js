import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const ContactFormEmail = ({ name, email, phone, subject, message }) => {
  const previewText = `New message from ${name} via your website`;

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              "citius-blue": "#102A83",
              "citius-orange": "#F58220",
              "brand-dark": "#111827",
              "brand-muted": "#6B7280",
              "brand-light": "#F9FAFB",
              "brand-border": "#E5E7EB",
            },
          },
        },
      }}
    >
      <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body className="bg-brand-light font-sans">
          <Container className="max-w-2xl bg-brand-dark mx-auto rounded-xl">
            <div className="pt-4">
              <Section className="bg-gradient-to-r from-citius-blue to-[#1e3a8a] text-white text-center py-12 px-8 rounded-t-2xl">
                <div className="inline-block w-16 h-16 bg-white/20 rounded-full mb-6">
                  <Row style={{ height: "64px" }}>
                    <Column
                      style={{
                        width: "64px",
                        verticalAlign: "middle",
                        textAlign: "center",
                      }}
                    >
                      <Text className="text-3xl m-0">📧</Text>
                    </Column>
                  </Row>
                </div>
                <Heading className="text-3xl font-bold m-0 mb-3">
                  New Contact Form Submission
                </Heading>
                <Text className="text-lg opacity-90 m-0">
                  You have received a new message from your website
                </Text>
              </Section>
            </div>

            <Section className="bg-brand-dark px-8 py-8 shadow-lg">
              <Section className="bg-brand-dark mb-8">
                <Heading className="text-lg font-semibold text-brand-light pt-6 pl-5 pb-2 mb-6 m-0">
                  Contact Information
                </Heading>

                <div className="space-y-4">
                  <div className="pl-4">
                    <Row>
                      <Column
                        style={{ width: "56px", verticalAlign: "middle" }}
                      >
                        <div className="w-10 h-10 bg-citius-orange/10 rounded-lg text-center">
                          <Text className="text-lg m-0 leading-10">👤</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="text-sm font-medium text-brand-muted"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Name
                        </Text>
                        <Text
                          className="text-base font-semibold text-brand-light"
                          style={{ margin: 0 }}
                        >
                          {name}
                        </Text>
                      </Column>
                    </Row>
                  </div>

                  <div className="pl-4">
                    <Row>
                      <Column
                        style={{ width: "56px", verticalAlign: "middle" }}
                      >
                        <div className="w-10 h-10 bg-citius-orange/10 rounded-lg text-center">
                          <Text className="text-lg m-0 leading-10">📧</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="text-sm font-medium text-brand-muted"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Email Address
                        </Text>
                        <Text style={{ margin: 0 }}>
                          <a
                            href={`mailto:${email}`}
                            className="text-citius-orange font-semibold text-base hover:underline"
                          >
                            {email}
                          </a>
                        </Text>
                      </Column>
                    </Row>
                  </div>

                  {phone && (
                    <div className="pl-4">
                      <Row>
                        <Column
                          style={{ width: "56px", verticalAlign: "middle" }}
                        >
                          <div className="w-10 h-10 bg-citius-orange/10 rounded-lg text-center">
                            <Text className="text-lg m-0 leading-10">📞</Text>
                          </div>
                        </Column>
                        <Column style={{ verticalAlign: "middle" }}>
                          <Text
                            className="text-sm font-medium text-brand-muted"
                            style={{ margin: "0 0 2px 0" }}
                          >
                            Phone Number
                          </Text>
                          <Text style={{ margin: 0 }}>
                            <a
                              href={`tel:${phone}`}
                              className="text-citius-orange font-semibold text-base hover:underline"
                            >
                              {phone}
                            </a>
                          </Text>
                        </Column>
                      </Row>
                    </div>
                  )}

                  <div className="pl-4">
                    <Row>
                      <Column
                        style={{ width: "56px", verticalAlign: "middle" }}
                      >
                        <div className="w-10 h-10 bg-citius-orange/10 rounded-lg text-center">
                          <Text className="text-lg m-0 leading-10">📋</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="text-sm font-medium text-brand-muted"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Subject
                        </Text>
                        <Text
                          className="text-base font-semibold text-brand-light"
                          style={{ margin: 0 }}
                        >
                          {subject}
                        </Text>
                      </Column>
                    </Row>
                  </div>
                </div>
              </Section>

              <Section className="mb-8">
                <div className="pl-4 mb-4">
                  <Row>
                    <Column style={{ width: "52px", verticalAlign: "middle" }}>
                      <div className="w-10 h-10 bg-citius-orange/10 rounded-lg text-center">
                        <Text className="text-lg m-0 leading-10">💬</Text>
                      </div>
                    </Column>
                    <Column style={{ verticalAlign: "middle" }}>
                      <Heading className="text-xl font-semibold text-brand-light m-0">
                        Message
                      </Heading>
                    </Column>
                  </Row>
                </div>

                <Section className="bg-brand-dark rounded-xl">
                  <div className="pl-5">
                    <Text className="text-base leading-relaxed text-brand-light m-0 whitespace-pre-wrap">
                      {message}
                    </Text>
                  </div>
                </Section>
              </Section>

              <Section className="text-center mb-8">
                <Button
                  href={`mailto:${email}`}
                  className="bg-citius-blue text-white px-8 py-4 rounded-lg font-semibold text-base hover:bg-citius-blue/90 transition-colors"
                >
                  Reply to {name}
                </Button>
              </Section>
            </Section>

            <Section className="bg-brand-dark text-center py-8 px-8 rounded-b-2xl">
              <Text className="text-white/80 text-sm m-0 mb-2">
                <strong>Contact Form Submission</strong>
              </Text>
              <Text className="text-white/60 text-xs m-0 mb-4">
                Received on{" "}
                {new Date().toLocaleString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </Text>
              <div>
                <Text className="text-brand-light/50 pb-5 text-xs m-0">
                  This email was automatically generated from your website&apos;s
                  contact form.
                </Text>
              </div>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default ContactFormEmail;
