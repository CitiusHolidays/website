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

export const ContactFormEmail = ({ name, email, phone, subject, message, receivedAt }) => {
  const previewText = `New message from ${name} via your website`;

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              "brand-border": "#E5E7EB",
              "brand-dark": "#111827",
              "brand-light": "#F9FAFB",
              "brand-muted": "#6B7280",
              "citius-blue": "#102A83",
              "citius-orange": "#F58220",
            },
          },
        },
      }}
    >
      <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body className="bg-brand-light font-sans">
          <Container className="mx-auto max-w-2xl rounded-xl bg-brand-dark">
            <div className="pt-4">
              <Section className="rounded-t-2xl bg-gradient-to-r from-citius-blue to-[#1e3a8a] px-8 py-12 text-center text-white">
                <div className="mb-6 inline-block size-16 rounded-full bg-white/20">
                  <Row style={{ height: "64px" }}>
                    <Column
                      style={{
                        textAlign: "center",
                        verticalAlign: "middle",
                        width: "64px",
                      }}
                    >
                      <Text className="m-0 text-3xl">📧</Text>
                    </Column>
                  </Row>
                </div>
                <Heading className="m-0 mb-3 font-bold text-3xl">
                  New Contact Form Submission
                </Heading>
                <Text className="m-0 text-lg opacity-90">
                  You have received a new message from your website
                </Text>
              </Section>
            </div>

            <Section className="bg-brand-dark p-8 shadow-lg">
              <Section className="mb-8 bg-brand-dark">
                <Heading className="m-0 mb-6 pt-6 pb-2 pl-5 font-semibold text-brand-light text-lg">
                  Contact Information
                </Heading>

                <div className="space-y-4">
                  <div className="pl-4">
                    <Row>
                      <Column style={{ verticalAlign: "middle", width: "56px" }}>
                        <div className="size-10 rounded-lg bg-citius-orange/10 text-center">
                          <Text className="m-0 text-lg leading-10">👤</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="font-medium text-brand-muted text-sm"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Name
                        </Text>
                        <Text
                          className="font-semibold text-base text-brand-light"
                          style={{ margin: 0 }}
                        >
                          {name}
                        </Text>
                      </Column>
                    </Row>
                  </div>

                  <div className="pl-4">
                    <Row>
                      <Column style={{ verticalAlign: "middle", width: "56px" }}>
                        <div className="size-10 rounded-lg bg-citius-orange/10 text-center">
                          <Text className="m-0 text-lg leading-10">📧</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="font-medium text-brand-muted text-sm"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Email Address
                        </Text>
                        <Text style={{ margin: 0 }}>
                          <a
                            className="font-semibold text-base text-citius-orange hover:underline"
                            href={`mailto:${email}`}
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
                        <Column style={{ verticalAlign: "middle", width: "56px" }}>
                          <div className="size-10 rounded-lg bg-citius-orange/10 text-center">
                            <Text className="m-0 text-lg leading-10">📞</Text>
                          </div>
                        </Column>
                        <Column style={{ verticalAlign: "middle" }}>
                          <Text
                            className="font-medium text-brand-muted text-sm"
                            style={{ margin: "0 0 2px 0" }}
                          >
                            Phone Number
                          </Text>
                          <Text style={{ margin: 0 }}>
                            <a
                              className="font-semibold text-base text-citius-orange hover:underline"
                              href={`tel:${phone}`}
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
                      <Column style={{ verticalAlign: "middle", width: "56px" }}>
                        <div className="size-10 rounded-lg bg-citius-orange/10 text-center">
                          <Text className="m-0 text-lg leading-10">📋</Text>
                        </div>
                      </Column>
                      <Column style={{ verticalAlign: "middle" }}>
                        <Text
                          className="font-medium text-brand-muted text-sm"
                          style={{ margin: "0 0 2px 0" }}
                        >
                          Subject
                        </Text>
                        <Text
                          className="font-semibold text-base text-brand-light"
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
                <div className="mb-4 pl-4">
                  <Row>
                    <Column style={{ verticalAlign: "middle", width: "52px" }}>
                      <div className="size-10 rounded-lg bg-citius-orange/10 text-center">
                        <Text className="m-0 text-lg leading-10">💬</Text>
                      </div>
                    </Column>
                    <Column style={{ verticalAlign: "middle" }}>
                      <Heading className="m-0 font-semibold text-brand-light text-xl">
                        Message
                      </Heading>
                    </Column>
                  </Row>
                </div>

                <Section className="rounded-xl bg-brand-dark">
                  <div className="pl-5">
                    <Text className="m-0 whitespace-pre-wrap text-base text-brand-light leading-relaxed">
                      {message}
                    </Text>
                  </div>
                </Section>
              </Section>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-lg bg-citius-blue px-8 py-4 font-semibold text-base text-white transition-colors hover:bg-citius-blue/90"
                  href={`mailto:${email}`}
                >
                  Reply to {name}
                </Button>
              </Section>
            </Section>

            <Section className="rounded-b-2xl bg-brand-dark p-8 text-center">
              <Text className="m-0 mb-2 text-sm text-white/80">
                <strong>Contact Form Submission</strong>
              </Text>
              <Text className="m-0 mb-4 text-white/60 text-xs">Received on {receivedAt}</Text>
              <div>
                <Text className="m-0 pb-5 text-brand-light/50 text-xs">
                  This email was automatically generated from your website&apos;s contact form.
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
