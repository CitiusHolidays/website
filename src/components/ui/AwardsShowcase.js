const awards = [
  {
    title: "National Tourism Award",
    year: "2017-18",
  },
  {
    title: "Dubai MICE Silver Award",
    year: "2023-24",
  },
  {
    title: "Thailand MICE Award",
    year: "2022-23, 2023-24",
  },
  {
    title: "Hong Kong Top MICE Agent Awards",
    year: "2017",
  },
];

export default function AwardsShowcase() {
  return (
    <section
      aria-labelledby="industry-recognition-heading"
      className="border-public-blue/15 border-t py-6"
    >
      <h3
        className="mb-5 font-heading font-semibold text-public-ink text-xl"
        id="industry-recognition-heading"
      >
        Industry recognition
      </h3>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {awards.map(({ title, year }) => (
          <li key={title}>
            <p className="font-medium text-public-ink">{title}</p>
            <p className="mt-1 text-public-muted text-sm">{year}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
