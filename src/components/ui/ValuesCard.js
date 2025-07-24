import {
  BookOpen,
  Globe,
  Handshake,
  Heart,
  Plane,
  Sparkle,
  TreePine,
  Users,
} from "lucide-react";
import AnimatedSection from "../../components/layout/AnimatedSection";

const values = [
  {
    title: "Excellence",
    description:
      "We strive to exceed expectations with detail, finesse, and thoughtful planning.",
    icon: <Plane />,
  },
  {
    title: "Integrity",
    description:
      "We operate with transparency, trust, and respect in every interaction.",
    icon: <Globe />,
  },
  {
    title: "Innovation",
    description:
      "We use fresh thinking and smart tools to craft bold, modern travel solutions.",
    icon: <Sparkle />,
  },
  {
    title: "Relationships",
    description:
      "People matter most. We nurture genuine, long-term bonds with clients, partners, and our team.",
    icon: <Handshake />,
  },
  {
    title: "Sustainability",
    description:
      "We travel responsibly — respecting communities, culture, and the environment.",
    icon: <TreePine />,
  },
  {
    title: "Employee Development",
    description: "We invest in our people. Their growth fuels our growth.",
    icon: <BookOpen />,
  },
  {
    title: "Women's Inclusiveness",
    description:
      "We champion equal opportunities, leadership, and voices at every level.",
    icon: <Heart />,
  },
  {
    title: "Impact",
    description:
      "We design experiences that leave lasting impressions — not just itineraries.",
    icon: <Users />,
  },
];

export default function ValuesCard() {
  return (
    <AnimatedSection>
      <section className="px-4 py-16 bg-brand-light">
        <h2 className="mb-12 text-3xl font-bold text-center text-citius-blue">
          Our Values
        </h2>
        <div className="grid grid-cols-1 gap-8 mx-auto max-w-6xl sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <div
              key={value.title}
              className="relative group p-6 text-center bg-white rounded-lg border shadow-lg transition-all duration-300 ease-in-out border-brand-border hover:shadow-2xl hover:-translate-y-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-citius-orange to-citius-blue opacity-0 group-hover:opacity-20 transition-opacity duration-500 transform-gpu group-hover:scale-150 blur-2xl"></div>
              <div className="relative z-10">
                <div className="inline-flex justify-center items-center mb-4 w-10 h-10 text-brand-light rounded-full bg-citius-blue">
                  {value.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-brand-dark">
                  {value.title}
                </h3>
                <p className="text-sm leading-relaxed text-brand-muted">
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AnimatedSection>
  );
}
