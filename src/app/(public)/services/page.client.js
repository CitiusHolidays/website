import CircularServicesMenu from "@/components/ui/CircularServicesMenu";

export default function ServicesPage() {
  return (
    <>
      <div className="h-24 bg-public-night" />
      <section className="bg-public-paper px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <h1 className="mb-4 text-balance font-heading font-semibold text-3xl text-public-blue sm:text-5xl">
              Travel & Event Services
            </h1>
            <p className="max-w-2xl text-public-muted leading-relaxed">
              MICE, visa assistance, event management, branding, sporting hospitality, and
              pilgrimage routes — planned and delivered by one team.
            </p>
          </div>
          <CircularServicesMenu />
        </div>
      </section>
    </>
  );
}
