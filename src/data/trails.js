const trails = [
  {
    bookingOptions: [
      {
        href: "/contact",
        label: "Request detailed brochure",
        note: "Dates, inclusions, and registration steps",
      },
      { href: "/contact", label: "Contact yatra desk", note: "We respond within one business day" },
    ],
    departures: {
      batches: [
        {
          dates: [
            "June — September 2026 (multiple batches)",
            "Exact departure dates on request — early registration recommended",
          ],
          name: "Summer 2026",
        },
      ],
    },
    details: {
      accommodation: [
        { desc: "4-star hotels with modern amenities", type: "Kathmandu" },
        { desc: "Best available guesthouses with basic facilities", type: "Tibet Towns" },
        { desc: "Tented camps with sleeping bags and mats", type: "Kora Days" },
        {
          desc: "Rooms are on twin/triple sharing basis. Single occupancy available at extra cost.",
          type: "Note",
        },
      ],
      exclusions: [
        "Any personal expense",
        "Airfare or rail fare, or any other expenses from home location to Kathmandu airport",
        "Porter expenses at Kailash parikrama",
        "Any insurance",
        "Any medical expenses",
        "GST and TCS",
        "Any donation or tip to guide, sherpa, driver, cook, porter, priest, or any crew member",
        "Extra days’ accommodation in Kathmandu, Nepalgunj, Simikot, Hilsa, or Purang due to bad weather or flight cancellation",
        "Visa splitting charges and transportation charges if someone leaves early from Tibet",
        "Any evacuation, rescue, or additional charges or closures due to natural calamities or unforeseen circumstances",
        "Extra baggage charges on flights during the yatra",
        "Any price increase by CPSC (China Pilgrimage Service Company) or authorities",
        "Anything not listed under inclusions",
      ],
      inclusions: [
        "Visa and yatra permit support as per programme",
        "Pure vegetarian meals throughout the yatra",
        "Accommodation as per itinerary",
        "Transportation as per itinerary",
        "Experienced guide and crew team",
        "Gifts (as per Citius programme)",
        "Down jacket for the yatra",
        "Oxygen cylinder for emergency use",
        "Priest services at Lake Mansarovar",
      ],
      medical: {
        checkup: "Basic health checkup at Nyalam and Saga",
        emergency: "Emergency evacuation support available (cost borne by yatri)",
        guide: "Experienced guides trained in altitude sickness recognition and response",
        support: "Oxygen cylinders, first-aid kits, and basic medicines available throughout",
      },
    },
    gallery: [
      { alt: "Pashupatinath Temple, Kathmandu", src: "/gallery/spiritual/pashupatinath.webp" },
      //{ src: "/gallery/spiritual/kathmandu-to-kodari.webp", alt: "Road to the Nepal–Tibet border" },
      { alt: "Nyalam, first Tibetan town", src: "/gallery/spiritual/nyalam.webp" },
      { alt: "Acclimatization day in Saga", src: "/gallery/spiritual/acclimatization-saga.webp" },
      { alt: "Lake Mansarovar", src: "/gallery/spiritual/mansarovar-lake.webp" },
      { alt: "Drolma La Pass", src: "/gallery/spiritual/drolma-la.webp" },
      { alt: "Drolma Pass", src: "/gallery/spiritual/drolma-pass.webp" },
      { alt: "Gauri Kund near Drolma La", src: "/gallery/spiritual/gaurikunda.webp" },
      { alt: "Yatris with Mount Kailash", src: "/gallery/spiritual/grp-with-mt-kailash.webp" },
      { alt: "Mount Kailash", src: "/gallery/spiritual/golden-kailash.webp" },
      {
        alt: "Moonrise over the sacred landscape",
        src: "/gallery/spiritual/full-moon-kailash.webp",
      },
      { alt: "Kora path through high-country terrain", src: "/gallery/spiritual/nature-kora.webp" },
      { alt: "Mount Kailash — darshan with the group", src: "/gallery/spiritual/aerial-view.webp" },
      { alt: "Welcome to Kathmandu", src: "/gallery/spiritual/welcome-kathmandu.webp" },
      { alt: "Yam Dwar", src: "/gallery/spiritual/yam-dwar.webp" },
      { alt: "Group on the Kailash Kora", src: "/gallery/spiritual/kora-group.webp" },
      { alt: "Kora path", src: "/gallery/spiritual/kora-path.webp" },
      { alt: "After the Kora", src: "/gallery/spiritual/joy-after-kora.webp" },
    ],
    group: "kailash-mansarovar",
    groupLabel: "Kailash Mansarovar",
    heroBackground: {
      alt: "Mount Kailash — sacred peak at dawn",
      src: "/gallery/spiritual/golden-kailash.webp",
    },
    highlights: [
      {
        description:
          "Begin your sacred journey at one of the most significant Shiva temples, seeking blessings for the yatra ahead.",
        location: "Kathmandu, Nepal",
        significance: "Spiritual commencement",
        title: "Pashupatinath Temple",
      },
      {
        description:
          "The highest freshwater lake in the world, believed to be the mind of Brahma. Experience the sacred bath and meditation.",
        location: "Tibet, 4,590m",
        significance: "Cleansing & rebirth",
        title: "Lake Mansarovar",
      },
      {
        description:
          "The ultimate spiritual goal — the 53km circumambulation of the abode of Lord Shiva, undertaken by devotees for millennia.",
        location: "Tibet, 6,638m peak",
        significance: "Liberation (Moksha)",
        title: "Mount Kailash Kora",
      },
      {
        description:
          "The highest point of the Kora, where yatris leave behind something symbolic — a prayer, a burden, an ego.",
        location: "5,650m elevation",
        significance: "Transformation point",
        title: "Drolma La Pass",
      },
      {
        description:
          "The frozen lake associated with Goddess Parvati. A moment of profound feminine divine energy.",
        location: "En route to Drolma La",
        significance: "Divine feminine grace",
        title: "Gaurikunda",
      },
    ],
    id: "kailash-mansarovar-14day",
    info: {
      bestTime: "June to September (monsoon season in Nepal but dry in Tibet)",
      eligibility: [
        "Age: 15–70 years (fitness certificate mandatory for 50+)",
        "Must be physically mobile and able to walk 5–7 km per day",
        "No recent surgery or hospitalization within 6 months",
        "No major heart, lung, kidney, or chronic conditions",
        "Valid passport with 6+ months validity",
        "Indian citizens: valid ID proof. NRI/OCI: valid overseas passport",
      ],
      medicalRequirements: [
        "Mandatory medical fitness certificate from registered doctor",
        "Blood pressure, diabetes, and asthma must be under control",
        "Pregnant women and those with severe altitude sickness history not permitted",
        "Personal medications to be carried in sufficient quantity",
      ],
      safetyNotes: [
        "Altitude sickness is real — acclimatization days are mandatory",
        "Follow guide instructions at all times",
        "Stay hydrated — drink minimum 3-4 liters water daily",
        "Do not consume alcohol during the yatra",
        "Respect local customs and sacred sites",
      ],
      visa: {
        connectivity:
          "Limited mobile network. Indian SIMs may work near border. Wi-Fi available at select hotels in Kathmandu only.",
        title: "Valid passport & Tibet Travel Permit required",
      },
      whatToPack: [
        "Warm layers: thermal innerwear, fleece jackets, down jacket",
        "Waterproof trekking shoes with ankle support",
        "Sun protection: cap, sunglasses, high SPF sunscreen",
        "Personal medication and basic first-aid kit",
        "Water bottle, energy snacks, walking pole (optional but recommended)",
        "Backpack (day bag) and duffel bag for main luggage",
      ],
    },
    itinerary: [
      {
        accommodation: "4-star hotel in Kathmandu",
        day: "Day 1",
        desc: "Welcome to the spiritual capital. Airport transfer to hotel, evening orientation with yatra leader, and group dinner. Rest and preparation.",
        highlights: ["Airport pickup", "Hotel check-in", "Orientation session"],
        image: {
          alt: "Kathmandu — arrival and welcome",
          src: "/gallery/spiritual/welcome-kathmandu.webp",
        },
        meals: "Dinner",
        title: "Arrival in Kathmandu",
      },
      {
        accommodation: "Kathmandu",
        day: "Day 2",
        desc: "Early morning visit to Pashupatinath Temple for sacred darshan and blessings. Afternoon briefing on altitude acclimatization, packing check, and documentation.",
        highlights: ["Pashupatinath Temple visit", "Sacred rituals", "Yatra briefing"],
        image: {
          alt: "Pashupatinath Temple, Kathmandu",
          src: "/gallery/spiritual/pashupatinath.webp",
        },
        meals: "Breakfast, Lunch, Dinner",
        title: "Pashupatinath Darshan & Preparation",
      },
      {
        accommodation: "Guesthouse in Kodari",
        altitude: "2,500m",
        day: "Day 3",
        desc: "Scenic drive through the Himalayan foothills to Kodari, the Nepal-Tibet border town. Final night in Nepal.",
        highlights: ["Himalayan drive", "Border town arrival"],
        image: {
          alt: "Road toward the Nepal–Tibet border",
          src: "/gallery/spiritual/kathmandu-to-kodari.webp",
        },
        meals: "All meals",
        title: "Kathmandu to Kodari (Border)",
      },
      {
        accommodation: "Guesthouse in Nyalam",
        altitude: "3,750m",
        day: "Day 4",
        desc: "Cross into Tibet. Immigration formalities and drive to Nyalam, the first Tibetan town. Begin altitude acclimatization.",
        highlights: ["Border crossing", "Tibet entry", "First views of Tibetan plateau"],
        image: {
          alt: "Nyalam — first Tibetan town",
          src: "/gallery/spiritual/nyalam.webp",
        },
        meals: "All meals",
        title: "Kodari to Nyalam (Tibet Entry)",
      },
      {
        accommodation: "Guesthouse in Saga",
        altitude: "4,600m",
        day: "Day 5",
        desc: "Drive through the vast Tibetan plateau with panoramic Himalayan views. En route, witness the changing landscape as we gain altitude.",
        highlights: ["Tibetan plateau landscapes", "Himalayan panoramas", "Wildlife spotting"],
        image: {
          alt: "Tibetan plateau en route from Nyalam to Saga",
          src: "/gallery/spiritual/nyalam-to-saga.webp",
        },
        meals: "All meals",
        title: "Nyalam to Saga",
      },
      {
        accommodation: "Saga",
        altitude: "4,600m",
        day: "Day 6",
        desc: "Rest day for altitude adjustment. Light walks, meditation sessions, and yatra leader discussions on the spiritual significance of the journey.",
        highlights: ["Rest & acclimatization", "Meditation sessions", "Spiritual discourse"],
        image: {
          alt: "Acclimatization day in Saga",
          src: "/gallery/spiritual/acclimatization-saga.webp",
        },
        meals: "All meals",
        title: "Acclimatization Day in Saga",
      },
      {
        accommodation: "Guesthouse in Darchen",
        altitude: "4,670m",
        day: "Day 7",
        desc: "The most awaited day. Drive to the sacred Lake Mansarovar for holy dip and puja. Circumambulate part of the lake, then proceed to Darchen, base for Kailash Kora.",
        highlights: [
          "First view of Lake Mansarovar",
          "Holy dip (optional)",
          "Sacred rituals",
          "Drive to Darchen",
        ],
        image: {
          alt: "Lake Mansarovar",
          src: "/gallery/spiritual/mansarovar-lake.webp",
        },
        meals: "All meals",
        title: "Saga to Lake Mansarovar to Darchen",
      },
      {
        accommodation: "Darchen",
        altitude: "4,670m",
        day: "Day 8",
        desc: "Rest day in Darchen. Optional visit to Asthapad and Nandi Parvat for darshan. Final preparations for the Kora.",
        highlights: [
          "Rest day",
          "Nandi Parvat darshan",
          "Asthapad visit (optional)",
          "Kora preparation",
        ],
        image: {
          alt: "Mount Kailash from the plateau near Darchen",
          src: "/gallery/spiritual/grp-with-mt-kailash.webp",
        },
        meals: "All meals",
        title: "Darchen — Rest & Rituals",
      },
      {
        accommodation: "Dirapuk guesthouse/tents",
        altitude: "4,900m",
        day: "Day 9",
        desc: "Begin the sacred Kora. Drive to Yama Dwar, then trek to Dirapuk. First close views of Mount Kailash's North Face — a sight that leaves yatris transformed.",
        highlights: ["Yama Dwar (Gate of the God of Death)", "Trek begins", "North Face darshan"],
        image: {
          alt: "Yama Dwar — start of the Kora",
          src: "/gallery/spiritual/yam-dwar.webp",
        },
        meals: "All meals",
        title: "Kora Day 1: Darchen to Dirapuk",
        trek: "12km trek",
      },
      {
        accommodation: "Juthulpuk guesthouse/tents",
        altitude: "5,650m (max) → 4,760m",
        day: "Day 10",
        desc: "The most challenging and rewarding day. Cross Drolma La Pass (5,650m), visit Gaurikunda, and descend to Juthulpuk. This is where transformation happens.",
        highlights: ["Drolma La Pass (5,650m)", "Gaurikunda", "Descent to Juthulpuk"],
        image: {
          alt: "Drolma La Pass",
          src: "/gallery/spiritual/drolma-la.webp",
        },
        meals: "All meals",
        title: "Kora Day 2: Dirapuk to Juthulpuk via Drolma La",
        trek: "22km trek (hardest day)",
      },
      {
        accommodation: "Saga",
        altitude: "4,600m",
        day: "Day 11",
        desc: "Complete the Kora with a gentle trek back to Darchen. Drive back to Saga, celebrating the completion of the sacred circumambulation.",
        highlights: ["Kora completion", "Certificate ceremony", "Return to Saga"],
        image: {
          alt: "Yatris after completing the Kailash Kora",
          src: "/gallery/spiritual/joy-after-kora.webp",
        },
        meals: "All meals",
        title: "Kora Day 3: Juthulpuk to Darchen to Saga",
        trek: "8km trek",
      },
      {
        accommodation: "Nyalam",
        altitude: "3,750m",
        day: "Day 12",
        desc: "Begin the return journey, driving back through the Tibetan plateau. Reflection time and group sharing of experiences.",
        highlights: ["Return drive", "Group sharing", "Reflection"],
        image: {
          alt: "Return drive from Saga toward Nyalam",
          src: "/gallery/spiritual/saga-to-nyalam.webp",
        },
        meals: "All meals",
        title: "Saga to Nyalam",
      },
      {
        accommodation: "Kathmandu",
        day: "Day 13",
        desc: "Cross back into Nepal and drive to Kathmandu. Evening celebratory dinner and closing ceremony with certificates.",
        highlights: ["Return to Nepal", "Border crossing", "Closing ceremony"],
        image: {
          alt: "Return to Nepal — yatra group in the mountains; closing ceremony with certificates in Kathmandu",
          src: "/gallery/spiritual/kathmandu-return-day13-16x10.webp",
        },
        meals: "All meals",
        title: "Nyalam to Kathmandu",
      },
      {
        accommodation: "N/A",
        day: "Day 14",
        desc: "After breakfast, airport transfer for your onward journey. Carry the blessings of Kailash with you forever.",
        highlights: ["Breakfast", "Airport transfer"],
        image: {
          alt: "Departure from Kathmandu",
          src: "/gallery/spiritual/welcome-kathmandu.webp",
        },
        meals: "Breakfast",
        title: "Departure from Kathmandu",
      },
    ],
    itineraryTimelineImage: {
      alt: "Mount Kailash and the Tibetan plateau — the heart of the yatra",
      src: "/gallery/spiritual/golden-kailash.webp",
    },
    layoutVariant: "trek",
    overview: {
      closing: "Your only role is to show up with devotion.\nWe take care of everything else.",
      intro: [
        "For a true pilgrim, this journey is not about achievement — it is about dissolution. The mountains invite surrender, the vastness melts the ego, and every step becomes a movement toward inner silence.",
        "The 14-day Kailash Mansarovar Yatra is our most sacred offering. Beginning from Kathmandu, you'll traverse the Himalayas into Tibet, circumambulate the abode of Lord Shiva, and bathe in the pristine waters of Lake Mansarovar. This is not merely a trek; it is a transformational passage.",
      ],
      privateGroupNote:
        "For a group of 22 guests, we can curate a private, closed-group experience exclusively for your family and friends. Write or call us for more information.",
      promise: [
        "Spiritually curated 14-day itinerary with Himalayan support team",
        "Comprehensive acclimatization protocol for safety at altitude",
        "Sacred rituals at Pashupatinath, Lake Mansarovar & during Kora",
        "Emergency oxygen, medical support & evacuation assistance",
        "Comfortable accommodation and pure vegetarian meals throughout",
        "Guided by experienced yatra leaders who understand the spiritual significance",
      ],
      quote: "At Kailash, the mountain does not judge. It simply reflects who you truly are.",
      title: "A Journey Beyond Travel",
    },
    positioning:
      "For those seeking the complete pilgrimage experience — the physical journey that mirrors the inner transformation.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "Moderate to Challenging",
      duration: "14 Days",
      groupSize: "15-25 Yatris",
      maxAltitude: "5,650m (Drolma La Pass)",
      route: "Ex-Kathmandu",
    },
    registrationAndPolicy: {
      bookingFormNote:
        "Registration requires the Kailash Yatra booking form (we will provide the link or document when you enquire).",
      cancellationDisclaimer: [
        "We are not responsible for cancellation arising from industrial disputes, technical failure of transport, loss of earnings, late arrivals, or force majeure.",
        "We are not responsible for regulations or restrictions by Tibetan or Chinese authorities, or for any matter beyond our control.",
      ],
      fitnessCertificate:
        "One month before the yatra, submit a physical fitness certificate from any MBBS doctor. The certificate must not be more than one month old from the yatra departure date.",
      refundTiers: [
        {
          detail: "Full payment is refunded except the deposit.",
          window: "45–180 days before departure",
        },
        {
          detail: "75% of payment is returned except the deposit.",
          window: "30–45 days before departure",
        },
        {
          detail: "No refund.",
          window: "Within one month of the trip",
        },
      ],
      registrationSteps: [
        "Fill out the Kailash Yatra booking form.",
        "Submit a scanned colour copy of your passport.",
        "Pay the applicable fee as advised by our team.",
        "Attach a copy of identity proof — Indian passport holders should use a valid Indian passport; include two recent photographs with your submission.",
        "Submit the completed form together with the supporting proof.",
      ],
    },
    relatedBlogSlugs: [],
    slug: "kailash-mansarovar-14day",
    status: "published",
    subtitle: "A Sacred Himalayan Expedition of Inner Transformation",
    tagline: "Ex-Kathmandu | 14 Days | Max Altitude 5,650m",
    testimonialIds: [1, 3],
    title: "Kailash Mansarovar Yatra 2026",
  },
  {
    bookingOptions: [
      { href: "/contact", label: "Register interest", note: "Window seats and batch preferences" },
      { href: "/contact", label: "Ask about Deluxe vs Luxury", note: "Nepalgunj hotel tiers" },
    ],
    departures: {
      batches: [
        {
          dates: [
            "June — September 2026 (subject to weather and permits)",
            "Minimum 25 passengers per charter — join a waitlist early",
          ],
          name: "Charter season 2026",
        },
      ],
    },
    details: {
      accommodation: [
        {
          desc: "4-star equivalent hotel in Nepalgunj with modern amenities, A/C rooms, hot water",
          type: "Deluxe Package",
        },
        {
          desc: "5-star equivalent hotel in Nepalgunj with premium facilities, superior rooms, all amenities",
          type: "Luxury Package",
        },
        {
          desc: "Twin sharing basis. Single occupancy available at supplementary cost.",
          type: "Room Sharing",
        },
      ],
      exclusions: [
        "GST and applicable taxes",
        "Beverages other than specified (soft drinks, alcohol)",
        "Photography/videography charges at temples/sites",
        "Personal expenses: shopping, laundry, phone calls, tips",
        "Border clearance charges if any additional fees are levied",
        "Rescue/evacuation costs and travel insurance",
        "Medical expenses beyond basic first-aid",
        "Personal clothing and accessories",
        "Bardiya National Park add-on (available separately — ask our team)",
        "Anything not specifically mentioned in inclusions",
      ],
      inclusions: [
        "2 nights hotel accommodation in Nepalgunj as per package tier",
        "Pure vegetarian Indian meals (breakfast, lunch, dinner) — no onion/garlic",
        "Evening tea/coffee",
        "Chartered aerial flight with guaranteed window seats",
        "Bageshwari Temple visit and sacred pooja/hawan ceremony",
        "Lucknow-Nepalgunj-Lucknow surface transport in Innova (4-5 pax sharing)",
        "Experienced team leader assistance throughout",
        "All permits, entrance fees, and border crossing assistance",
        "Complimentary yatra kit: day bag, Mansarovar holy water bottle, completion certificate",
        "Basic medical kit support",
      ],
      transport: {
        border: "Assisted crossing at Rupaidiha border with complete documentation support",
        flight:
          "Chartered aircraft with all window seats guaranteed, approximately 1.5 hours flying time",
        surface: "Toyota Innova or similar SUV, 4-5 passengers per vehicle",
      },
    },
    gallery: [
      {
        alt: "Sacred Himalaya — view from the aerial darshan route",
        src: "/gallery/spiritual/aerial-view.webp",
      },
    ],
    group: "kailash-mansarovar",
    groupLabel: "Kailash Mansarovar",
    heroBackground: {
      alt: "Shree Airlines charter — aerial darshan of Mount Kailash and Lake Mansarovar",
      src: "/gallery/spiritual/aerial-charter-shree-kailash-lake.webp",
    },
    highlights: [
      {
        description:
          "Private chartered aircraft with guaranteed window seats for uninterrupted views of Mount Kailash and Lake Mansarovar.",
        location: "Exclusive charter",
        significance: "Divine darshan from the sky",
        title: "Chartered Aerial Flight",
      },
      {
        description:
          "Witness the sacred lake from above — a turquoise jewel in the Tibetan plateau, the mind of Brahma made visible.",
        location: "From 32,000 ft",
        significance: "Cleansing sight",
        title: "Lake Mansarovar Aerial View",
      },
      {
        description:
          "Southern and eastern faces of the sacred peak, with a sweeping Himalayan panorama — including peaks such as Api, Saipal, and Nampha — from the comfort of your window seat.",
        location: "From 32,000 ft",
        significance: "Shiva's abode",
        title: "Mount Kailash Aerial Darshan",
      },
      {
        description:
          "Ancient temple dedicated to Goddess Bageshwari (Durga). Sacred pooja and hawan ceremony before the aerial journey.",
        location: "Nepalgunj",
        significance: "Divine feminine blessings",
        title: "Bageshwari Temple",
      },
      {
        description:
          "Assisted border crossing with complete documentation support. Entry/exit through the Rupaidiha border.",
        location: "India-Nepal border",
        significance: "Sacred threshold",
        title: "Rupaidiha Border Crossing",
      },
    ],
    id: "kailash-aerial-3day",
    info: {
      addOnInfo:
        "Optional 1-night Bardiya National Park wildlife safari may be available — ask our team for details. Includes jungle safari, accommodation, and meals when offered.",
      bestTime: "June to September (weather dependent, subject to flight permissions)",
      borderInfo: {
        documents: "Valid Indian ID (Aadhaar, Passport, Voter ID) required for all travelers",
        title: "Entry/Exit through Rupaidiha border (India-Nepal)",
      },
      eligibility: [
        "Open to all ages (children below 5 years not recommended due to altitude)",
        "Senior citizens especially welcome — no physical exertion required",
        "Solo women travelers, group travelers, families all welcome",
        "Valid ID proof required for border crossing (Aadhaar, Passport, Voter ID)",
        "Minimum group size: 25 passengers required to operate the charter",
      ],
      groupSize:
        "Minimum 25 passengers required to operate the charter. Groups may be combined to meet minimum requirement.",
      mealPlan:
        "Pure vegetarian Indian cuisine prepared without onion and garlic. Jain meals available on request.",
      medicalRequirements: [
        "Basic fitness to travel by road and air",
        "Those with severe heart conditions or respiratory issues should consult doctor",
        "Carry personal medications",
        "Travel insurance recommended but not mandatory",
      ],
      whatToPack: [
        "Comfortable clothing for travel",
        "Light woolens for aircraft (temperature drops at altitude)",
        "Sunglasses for aerial viewing",
        "Camera/binoculars for better darshan experience",
        "Personal medication",
        "Valid ID proof (original + copies)",
      ],
    },
    itinerary: [
      {
        accommodation: "Hotel in Nepalgunj (4-star/5-star as per package)",
        day: "Day 1",
        desc: "Pickup from your hotel or designated point in Lucknow, then a scenic 4–5 hour drive to Nepalgunj via the India–Nepal border at Rupaidiha. Lunch at the hotel after check-in. Visit sacred Bageshwari Temple for a group hawan and pooja led by our Pandit ji. Evening briefing on the flight schedule and spiritual significance, followed by dinner and overnight at your premium Nepalgunj hotel.",
        highlights: [
          "Lucknow pickup",
          "Road journey to Nepalgunj (4–5 hours)",
          "Lunch at hotel",
          "Bageshwari Temple — pooja & hawan",
          "Evening briefing",
          "Dinner & overnight — Nepalgunj",
        ],
        image: {
          alt: "Day 1 — welcome and group at the Nepalgunj hotel",
          src: "/gallery/spiritual/aerial-itinerary-day1-soaltee-group.webp",
        },
        meals: "Lunch, Dinner",
        title: "Ex Lucknow | Road to Nepalgunj",
        transport: "Innova (4-5 pax per vehicle)",
      },
      {
        accommodation: "Nepalgunj",
        altitude: "32,000 ft",
        day: "Day 2",
        desc: "After breakfast, early transfer to Nepalgunj airport to board the specialised charter for Mount Kailash Aerial Darshan. Every yatri has a guaranteed window seat. On board, share in a divine atmosphere — Shiv Chalisa, bhajans, and mantras with Pandit ji. Witness the sacred peak (including the southern and rare eastern aspects), holy Lake Mansarovar, and a wide Himalayan panorama with peaks such as Api, Saipal, and Nampha. Return to Nepalgunj; evening at leisure for rest or quiet reflection. Dinner and overnight at the hotel.",
        flight: "Chartered aerial yatra (approx. 1.5 hours)",
        highlights: [
          "Airport transfer after breakfast",
          "Chartered aerial darshan flight",
          "Guaranteed window seat",
          "Kailash & Mansarovar from the air",
          "Chanting & bhajans on board",
          "Return to Nepalgunj — restful evening",
          "Dinner & overnight — Nepalgunj",
        ],
        image: {
          alt: "Charter flight over the snow-covered valley toward sunlit Mount Kailash",
          src: "/gallery/spiritual/aerial-day2-kailash-flight.webp",
        },
        meals: "Breakfast, Lunch, Dinner",
        title: "Kailash Aerial Darshan | The Sacred Flight",
      },
      {
        accommodation: "N/A",
        day: "Day 3",
        desc: "A relaxed breakfast at the hotel, then checkout and the drive back to Lucknow (about 4–5 hours) — a good time to reflect and share darshan with fellow yatris. On arrival in Lucknow we drop you at your home, the airport, or the railway station, carrying the blessings of Kailash with you.",
        highlights: [
          "Breakfast at hotel",
          "Checkout & drive to Lucknow (4–5 hours)",
          "Drop-off — residence, airport, or railway station",
        ],
        image: {
          alt: "Day 3 — yatris with certificates after the charter, Nepalgunj airport",
          src: "/gallery/spiritual/aerial-itinerary-day3-tarmac-group.webp",
        },
        meals: "Breakfast",
        title: "Mission Complete | Return to Lucknow",
        transport: "Innova to Lucknow",
      },
    ],
    layoutVariant: "aerial",
    overview: {
      closing: "The blessings are the same.\nOnly the path differs.",
      intro: [
        "Not everyone can trek through high altitudes and harsh terrain. But the call of Kailash is universal. Our Aerial Darshan programme is for those who seek the blessings of Mount Kailash and Lake Mansarovar without the physical demands of the traditional yatra.",
        "This 2-night, 3-day journey begins in Lucknow and unfolds through Nepalgunj, where you board a chartered flight for an exclusive aerial view of Lake Mansarovar and Mount Kailash. Guaranteed window seats give every yatri uninterrupted darshan of the abode of Lord Shiva.",
        "Many yatris who experience aerial darshan go on to join our full 14-day Mansarovar yatra — when you are ready to stand at the holy lake and complete the kora by foot.",
      ],
      promise: [
        "Chartered aerial flight with guaranteed window seats for every yatri",
        "Pure vegetarian Indian meals (no onion/garlic) throughout",
        "Comfortable road journey from Lucknow in Innova (4-5 pax per vehicle)",
        "Bageshwari Temple visit and sacred pooja/hawan ceremony",
        "Team leader assistance from Lucknow to return",
        "All permits, entrance fees, and border formalities handled",
        "Complimentary yatra kit: day bag, Mansarovar water bottle, completion certificate",
      ],
      quote: "The mountain sees all who come with devotion — whether by foot or by wing.",
      title: "The Sky Path to Kailash",
    },
    positioning:
      "For senior yatris, solo seekers, women travellers, and families — elderly-friendly arrangements, thoughtful support, and divine darshan without strenuous trekking.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "Easy (No trekking)",
      duration: "2 Nights / 3 Days",
      groupSize: "Minimum 25 pax required",
      maxAltitude: "32,000 ft (aerial)",
      route: "Lucknow → Nepalgunj → Aerial Darshan → Return",
    },
    relatedBlogSlugs: [],
    slug: "kailash-aerial-3day",
    status: "published",
    subtitle:
      "A Sacred Himalayan Expedition of Inner Transformation — Minimal Effort, Maximum Blessings",
    tagline: "Ex-Lucknow | 2N/3D | Aerial Altitude 32,000 ft",
    testimonialIds: [2, 4],
    title: "Kailash Mansarovar Aerial View Tour",
  },
  {
    bookingOptions: [
      { href: "/contact", label: "Express interest", note: "Mention North Trail in your message" },
    ],
    departures: null,
    details: null,
    gallery: [],
    group: "kora-routes",
    groupLabel: "Kora routes",
    heroBackground: {
      alt: "Lake Mansarovar beneath the sacred range",
      src: "/gallery/spiritual/mansarovar-lake.webp",
    },
    highlights: null,
    id: "kora-north-trail",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "We are preparing a dedicated North Trail experience alongside our flagship Kailash Mansarovar programmes. Share your contact details and we will notify you when departures are published.",
        "Until then, the complete 14-day Kailash Mansarovar Yatra remains our primary overland pilgrimage with full Kora.",
      ],
      promise: [
        "Priority notification when this trail opens for booking",
        "The same Citius safety and spiritual curation standards",
      ],
      title: "Register your interest",
    },
    positioning:
      "For devotees drawn to the north aspect of the sacred circuit. Full logistics and dates are being finalised.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "TBC",
      duration: "To be announced",
      groupSize: "TBC",
      maxAltitude: "TBC",
      route: "Kailash region",
    },
    relatedBlogSlugs: [],
    slug: "kora-north-trail",
    status: "comingSoon",
    subtitle: "Focused on the north face experience — itinerary launching soon.",
    tagline: "Coming soon | 2026",
    testimonialIds: [],
    title: "North Trail",
  },
  {
    bookingOptions: [{ href: "/contact", label: "Express interest", note: "Mention East Trail" }],
    departures: null,
    details: null,
    gallery: [],
    group: "kora-routes",
    groupLabel: "Kora routes",
    heroBackground: {
      alt: "Kailash kora path",
      src: "/gallery/spiritual/kora-path.webp",
    },
    highlights: null,
    id: "kora-east-trail",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "The East Trail is in planning. Leave your details with our team to receive the brochure as soon as it is available.",
      ],
      promise: ["Early access to dates and brochure", "Guidance on fitness and documentation"],
      title: "Register your interest",
    },
    positioning:
      "A future offering for yatris seeking an eastern emphasis along the sacred landscape.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "TBC",
      duration: "To be announced",
      groupSize: "TBC",
      maxAltitude: "TBC",
      route: "Kailash region",
    },
    relatedBlogSlugs: [],
    slug: "kora-east-trail",
    status: "comingSoon",
    subtitle: "Eastern approach — details coming soon.",
    tagline: "Coming soon | 2026",
    testimonialIds: [],
    title: "East Trail",
  },
  {
    bookingOptions: [{ href: "/contact", label: "Express interest", note: "Mention West Trail" }],
    departures: null,
    details: null,
    gallery: [],
    group: "kora-routes",
    groupLabel: "Kora routes",
    heroBackground: {
      alt: "Drolma La Pass high on the kora",
      src: "/gallery/spiritual/drolma-la.webp",
    },
    highlights: null,
    id: "kora-west-trail",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "We are curating the West Trail with our Himalayan partners. Contact us to join the priority list.",
      ],
      promise: ["Notification when bookings open", "Compatibility check with the 14-day yatra"],
      title: "Register your interest",
    },
    positioning:
      "Designed for seekers who resonate with the western arc of the journey — more information soon.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "TBC",
      duration: "To be announced",
      groupSize: "TBC",
      maxAltitude: "TBC",
      route: "Kailash region",
    },
    relatedBlogSlugs: [],
    slug: "kora-west-trail",
    status: "comingSoon",
    subtitle: "Western emphasis — itinerary in development.",
    tagline: "Coming soon | 2026",
    testimonialIds: [],
    title: "West Trail",
  },
  {
    bookingOptions: [{ href: "/contact", label: "Express interest", note: "Mention South Trail" }],
    departures: null,
    details: null,
    gallery: [],
    group: "kora-routes",
    groupLabel: "Kora routes",
    heroBackground: {
      alt: "Yam Dwar on the sacred circuit",
      src: "/gallery/spiritual/yam-dwar.webp",
    },
    highlights: null,
    id: "kora-south-trail",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "The South Trail programme is not yet open for booking. Reach out to be notified first.",
      ],
      promise: ["Updates on itinerary and inclusions", "Dedicated yatra consultant"],
      title: "Register your interest",
    },
    positioning: "A future specialised option complementing our main Mansarovar offering.",
    quickFacts: {
      bestTime: "June – September",
      difficulty: "TBC",
      duration: "To be announced",
      groupSize: "TBC",
      maxAltitude: "TBC",
      route: "Kailash region",
    },
    relatedBlogSlugs: [],
    slug: "kora-south-trail",
    status: "comingSoon",
    subtitle: "Southern route focus — launching soon.",
    tagline: "Coming soon | 2026",
    testimonialIds: [],
    title: "South Trail",
  },
  {
    bookingOptions: [
      { href: "/contact", label: "Express interest", note: "Mention Sacred Festivals" },
    ],
    departures: null,
    details: null,
    gallery: [],
    group: "special-programs",
    groupLabel: "Special programs",
    heroBackground: {
      alt: "Pashupatinath Temple, Kathmandu",
      src: "/gallery/spiritual/pashupatinath.webp",
    },
    highlights: null,
    id: "sacred-festivals",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "We are designing festival-aligned departures with additional ritual support and storytelling. Tell us which occasions matter most to you.",
      ],
      promise: ["Festival calendar when confirmed", "Small-group options where possible"],
      title: "Register your interest",
    },
    positioning:
      "For pilgrims who wish to travel during festival windows with curated rituals and community.",
    quickFacts: {
      bestTime: "Festival calendar TBC",
      difficulty: "TBC",
      duration: "To be announced",
      groupSize: "TBC",
      maxAltitude: "TBC",
      route: "Himalaya / Kailash region",
    },
    relatedBlogSlugs: [],
    slug: "sacred-festivals",
    status: "comingSoon",
    subtitle: "Timed journeys aligned with auspicious dates — programmes under design.",
    tagline: "Coming soon | 2026",
    testimonialIds: [],
    title: "Sacred Festivals",
  },
  {
    bookingOptions: [
      { href: "/contact", label: "Corporate enquiry", note: "We will schedule a discovery call" },
    ],
    departures: null,
    details: null,
    gallery: [],
    group: "special-programs",
    groupLabel: "Special programs",
    heroBackground: {
      alt: "Kathmandu — gateway to the Himalaya",
      src: "/gallery/spiritual/welcome-kathmandu.webp",
    },
    highlights: null,
    id: "corporate-retreat",
    info: null,
    itinerary: null,
    layoutVariant: "trek",
    overview: {
      intro: [
        "Corporate and institutional groups can work with Citius for customised spiritual retreats, including Kailash-region programmes where permits allow. Share your headcount, window, and objectives.",
      ],
      promise: ["Dedicated account liaison", "Alignment with compliance and duty of care"],
      title: "Start a conversation",
    },
    positioning:
      "Private batches, MICE-friendly logistics, and discretion for organisations seeking meaning beyond the boardroom.",
    quickFacts: {
      bestTime: "Year-round enquiry",
      difficulty: "Tailored",
      duration: "Custom",
      groupSize: "Private groups",
      maxAltitude: "TBC",
      route: "On request",
    },
    relatedBlogSlugs: [],
    slug: "corporate-retreat",
    status: "comingSoon",
    subtitle: "Leadership and team journeys with spiritual depth — bespoke planning.",
    tagline: "Coming soon | Enquire",
    testimonialIds: [],
    title: "Corporate Retreat",
  },
];

export const kailashTestimonials = [
  {
    id: 1,
    journey: "14-Day Kailash Yatra 2024",
    location: "Delhi",
    name: "Rajesh & Meena Sharma",
    quote:
      "The 14-day journey was transformative. When we crossed Drolma La Pass, something shifted within us. The Citius team handled everything with such care — we only had to focus on our spiritual experience. The medical support and acclimatization protocol made us feel safe throughout.",
    rating: 5,
  },
  {
    id: 2,
    journey: "Aerial Darshan 2024",
    location: "Mumbai",
    name: "Anita Desai",
    quote:
      "At 68, I thought my chance to see Kailash had passed. The aerial tour was perfect — I got my darshan without the physical strain. Looking at Kailash from the window seat, I wept with gratitude. The team treated us senior yatris with such respect and patience.",
    rating: 5,
  },
  {
    id: 3,
    journey: "14-Day Kailash Yatra 2023",
    location: "Ahmedabad",
    name: "Vikram Patel",
    quote:
      "I've done many treks in the Himalayas, but nothing prepared me for the energy of Mount Kailash. The Parikrama was challenging but the Citius guides kept us motivated with stories and spiritual context. The Pashupatinath visit at the start set the tone perfectly.",
    rating: 5,
  },
  {
    id: 4,
    journey: "Aerial Darshan 2024",
    location: "Bangalore",
    name: "Priya & Family",
    quote:
      "We took my 72-year-old father on the aerial tour. The look on his face when he saw Kailash from the sky was priceless. Pure vegetarian meals, comfortable hotels, and the window seat guarantee — every detail was thoughtful. A truly blessed experience.",
    rating: 5,
  },
];

export const sacredSites = [
  {
    description:
      "The Pashupatinath Temple complex, located on the banks of the Bagmati River, is the oldest Hindu temple in Kathmandu. For Kailash yatris, this is the spiritual commencement point — seeking Lord Shiva's blessings before embarking on the journey to his abode.",
    elevation: "1,400m",
    id: "pashupatinath",
    image: {
      alt: "Pashupatinath Temple, Kathmandu",
      src: "/gallery/spiritual/pashupatinath.webp",
    },
    location: "Kathmandu, Nepal",
    name: "Pashupatinath Temple",
    significance:
      "One of the most sacred Shiva temples, the journey begins here with blessings for the yatra ahead.",
  },
  {
    description:
      "At 4,590 meters, Lake Mansarovar is a jewel of turquoise waters set against the barren Tibetan plateau. Pilgrims perform parikrama, take the sacred bath, and collect holy water. The stillness of the lake reflects the stillness one seeks within.",
    elevation: "4,590m",
    id: "mansarovar",
    image: {
      alt: "Lake Mansarovar beneath the Himalaya",
      src: "/gallery/spiritual/mansarovar-lake.webp",
    },
    location: "Tibet",
    name: "Lake Mansarovar",
    significance:
      "The highest freshwater lake in the world, believed to be the mind of Brahma. A dip here is said to cleanse lifetimes of karma.",
  },
  {
    description:
      "Rising 6,638 meters into the Tibetan sky, Mount Kailash is sacred to four religions — Hinduism, Buddhism, Jainism, and Bon. No human has ever summited this peak; it remains a sacred space accessible only through the 53-kilometer kora (circumambulation).",
    elevation: "6,638m (peak)",
    id: "kailash",
    image: {
      alt: "Mount Kailash — sacred peak",
      src: "/gallery/spiritual/golden-kailash.webp",
    },
    location: "Tibet",
    name: "Mount Kailash",
    significance:
      "The abode of Lord Shiva, untouched by human climbers, circumambulated by devotees for millennia seeking liberation.",
  },
  {
    description:
      "At 5,650 meters, Drolma La (Goddess Tara Pass) is both the physical and spiritual climax of the Kora. Here, yatris leave offerings, prayers tied to stones, and symbolically release their burdens. The descent past Gaurikunda marks spiritual rebirth.",
    elevation: "5,650m",
    id: "drolmala",
    image: {
      alt: "Drolma La Pass on the Kailash Kora",
      src: "/gallery/spiritual/drolma-la.webp",
    },
    location: "En route Kailash Kora",
    name: "Drolma La Pass",
    significance:
      "The highest point of the Kora, where yatris leave behind prayers, burdens, and ego at the seat of the Goddess.",
  },
  {
    description:
      "Gaurikunda, the lake of Goddess Parvati (Gauri), lies frozen near Drolma La. It represents the divine feminine — the Shakti that complements Shiva's consciousness. Yatris pause here to honor the feminine principle before completing the descent.",
    elevation: "5,400m",
    id: "gaurikunda",
    image: {
      alt: "Gauri Kund near Drolma La",
      src: "/gallery/spiritual/gaurikunda.webp",
    },
    location: "Below Drolma La",
    name: "Gaurikunda",
    significance:
      "The frozen lake associated with Goddess Parvati, representing the divine feminine energy of transformation.",
  },
  {
    description:
      "Yama Dwar, the 'Gate of Yama' (the God of Death), marks the symbolic start of the inner journey. Here, yatris ritually 'die' to their old selves before beginning the Parikrama. Beyond this gate, the external world fades and the inner journey intensifies.",
    elevation: "4,700m",
    id: "yamadwar",
    image: {
      alt: "Yama Dwar — gateway to the Kailash Kora",
      src: "/gallery/spiritual/yam-dwar.webp",
    },
    location: "Kailash Kora Start",
    name: "Yama Dwar",
    significance:
      "The Gate of the God of Death — symbolically leaving behind the ego before beginning the sacred circumambulation.",
  },
];

/** Hub section order (trails grouped under these ids via `trail.group`) */
const trailGroupOrder = [
  { id: "kailash-mansarovar", label: "Kailash Mansarovar 2026" },
  { id: "kora-routes", label: "Kora routes" },
  { id: "special-programs", label: "Special programs" },
];

export function getTrailBySlug(slug) {
  if (!slug) {
    return null;
  }
  return trails.find((t) => t.slug === slug) ?? null;
}

export function getTrailsForHub() {
  return trails.filter((t) => t.status === "published" || t.status === "comingSoon");
}

export function getTrailSlugsForStaticParams() {
  return getTrailsForHub().map((t) => ({ slug: t.slug }));
}

export function getTrailTestimonials(trail) {
  if (!trail?.testimonialIds?.length) {
    return [];
  }
  return kailashTestimonials.filter((x) => trail.testimonialIds.includes(x.id));
}

export function groupTrailsForHub(trailList) {
  const map = new Map();
  for (const g of trailGroupOrder) {
    map.set(g.id, { id: g.id, label: g.label, trails: [] });
  }
  for (const t of trailList) {
    const entry = map.get(t.group);
    if (entry) {
      entry.trails.push(t);
    }
  }
  return trailGroupOrder.flatMap((g) => {
    const group = map.get(g.id);
    return group.trails.length > 0 ? [group] : [];
  });
}

/**
 * YouTube watch/share URLs → embed URL for iframes.
 */
export function toYoutubeEmbedUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }
  const u = url.trim();
  if (!u) {
    return null;
  }
  if (u.includes("youtube.com/embed/")) {
    return u.split("?")[0];
  }
  try {
    const parsed = new URL(u);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${v}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
