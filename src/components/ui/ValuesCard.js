import { BookOpen, Globe, Handshake, Heart, Plane, Sparkle, TreePine, Users } from "lucide-react";
import AnimatedSection from "../../components/layout/AnimatedSection";

const values = [
  {
    description: "We operate with transparency, trust, and respect in every interaction.",
    icon: <Globe />,
    title: "Integrity",
  },
  {
    description: "We strive to exceed expectations with detail, finesse, and thoughtful planning.",
    icon: <Plane />,
    title: "Excellence",
  },
  {
    description: "We use fresh thinking and smart tools to craft bold, modern travel solutions.",
    icon: <Sparkle />,
    title: "Innovation",
  },
  {
    description:
      "People matter most. We nurture genuine, long-term bonds with clients, partners, and our team.",
    icon: <Handshake />,
    title: "Relationships",
  },
  {
    description: "We travel responsibly — respecting communities, culture, and the environment.",
    icon: <TreePine />,
    title: "Sustainability",
  },
  {
    description: "We invest in our people. Their growth fuels our growth.",
    icon: <BookOpen />,
    title: "Employee Development",
  },
  {
    description: "We champion equal opportunities, leadership, and voices at every level.",
    icon: <Heart />,
    title: "Women's Inclusiveness",
  },
  {
    description: "We design experiences that leave lasting impressions — not just itineraries.",
    icon: <Users />,
    title: "Impact",
  },
];

export default function ValuesCard() {
  return (
    <AnimatedSection>
      <section className="bg-brand-light px-4 py-16">
        <h2 className="mb-12 text-center font-bold text-3xl text-citius-blue">Our Values</h2>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <div
              className="group relative overflow-hidden rounded-lg border border-brand-border bg-white p-6 text-center shadow-lg transition-[translate,box-shadow] duration-300 ease-out fine-hover:hover:-translate-y-2 hover:shadow-2xl"
              key={value.title}
            >
              <div className="absolute inset-0 transform-gpu bg-gradient-to-r from-citius-orange to-citius-blue opacity-0 blur-2xl transition-[scale,opacity] duration-500 fine-hover:group-hover:scale-150 group-hover:opacity-20" />
              <div className="relative z-10">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-full bg-citius-blue text-brand-light">
                  {value.icon}
                </div>
                <h3 className="mb-2 font-semibold text-brand-dark text-xl">{value.title}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AnimatedSection>
  );
}
