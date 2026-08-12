import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const OVERSTATED_PRESS_SCALE = /whileTap=\{\{\s*scale:\s*(?:0\.[0-5]\d*|0\.9\d*)/;
const MOTION_TRANSFORM_SHORTHAND = /\b(?:scaleY|scale|x|y):/;

describe("public hero and Concierge motion", () => {
  test("uses a compositor transform for hero scroll and delegates chat exit ownership to Dialog", () => {
    const hero = readFileSync("src/components/pages/HomeHeroClient.js", "utf8");
    const chatbot = readFileSync("src/components/ui/ChatbotWindow.js", "utf8");

    expect(hero).toContain('"translate3d(0, 0%, 0)"');
    expect(hero).toContain("style={{ opacity, transform }}");
    expect(hero).not.toContain("style={{ opacity, y }}");
    expect(chatbot).toContain("<ControlledDialog");
    expect(chatbot).toContain("data-[ending-style]:[transform:scale(0.95)]");
    expect(chatbot).toContain("triggerless");
    expect(chatbot).not.toContain("if (!isOpen) {\n    return null");
  });

  test("shares restrained press and contextual icon motion across affected controls", () => {
    const team = readFileSync("src/components/ui/TeamMember.js", "utf8");
    const sharedMotionControls = [
      "src/components/ui/AnimatedSubmitButton.js",
      "src/components/auth/AuthLoginForm.js",
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of sharedMotionControls) {
      expect(source).toContain('from "@/lib/publicInteractionMotion"');
      expect(source).not.toMatch(OVERSTATED_PRESS_SCALE);
    }
    expect(team).not.toMatch(OVERSTATED_PRESS_SCALE);
    expect(team).not.toContain("whileHover={{ scale: 1.1 }}");
  });

  test("keeps reduced-motion configuration hydration-stable on auth surfaces", () => {
    const provider = readFileSync("src/components/providers/ReducedMotionProvider.js", "utf8");
    const authForm = readFileSync("src/components/auth/AuthLoginForm.js", "utf8");

    expect(provider).toContain('isHydrated ? "user" : "always"');
    expect(provider).toContain("useState(false)");
    expect(provider).not.toContain("useReducedMotion");
    expect(authForm).toContain("useState(false)");
    expect(authForm).toContain("setShouldReduceMotion(!!prefersReducedMotion)");
  });

  test("keeps public disclosures, captions, connectors, and proof motion bounded", () => {
    const header = readFileSync("src/components/layout/Header.js", "utf8");
    const trails = readFileSync("src/components/layout/HeaderSpiritualTrailsDropdown.js", "utf8");
    const signIn = readFileSync("src/components/layout/HeaderSignInDropdown.js", "utf8");
    const userMenu = readFileSync("src/components/layout/HeaderUserMenu.js", "utf8");
    const spiritualHero = readFileSync("src/components/pilgrimage/SpiritualHero.js", "utf8");
    const services = readFileSync("src/components/ui/CircularServicesMenu.js", "utf8");
    const team = readFileSync("src/components/ui/TeamMember.js", "utf8");
    const contact = readFileSync("src/components/ui/ModernContactForm.js", "utf8");
    const clients = readFileSync("src/components/ui/ClientShowcase.js", "utf8");
    const partners = readFileSync("src/components/ui/PartnerShowcase.js", "utf8");

    expect(`${header}\n${trails}`).not.toContain('layoutId="navHover"');
    for (const disclosure of [trails, signIn, userMenu]) {
      expect(disclosure).toContain("publicDisclosureMotion");
      expect(disclosure).toContain("aria-expanded");
      expect(disclosure).toContain("aria-controls");
    }
    expect(spiritualHero).not.toContain("letterSpacing");
    expect(services).not.toContain("animate={{ x2:");
    expect(services).not.toContain("initial={{ x2:");
    expect(team).not.toContain('maxHeight: isExpanded ? "none"');
    expect(team).not.toContain("transition-[max-height]");
    expect(contact).not.toContain("transition-[translate,color,font-size,top]");
    expect(contact).not.toContain("<m.label");
    expect(clients).not.toContain("whileHover");
    expect(partners).not.toContain("whileHover");
    expect(partners).not.toContain("<LogoMarquee");
  });

  test("Concierge uses one full-transform motion channel without utility-control choreography", () => {
    const chatbotSources = [
      "src/components/ui/Chatbot.js",
      "src/components/ui/ChatbotWindow.js",
      "src/components/ui/ChatbotMessages.js",
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of chatbotSources) {
      expect(source).not.toMatch(MOTION_TRANSFORM_SHORTHAND);
    }
    expect(chatbotSources[1]).not.toContain('mode="wait"');
    expect(chatbotSources[1]).not.toContain("whileTap");
    expect(chatbotSources[2]).toContain("chatbot-curating-dot");
  });
});
