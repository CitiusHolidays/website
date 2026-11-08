import { v } from "convex/values";

/**
 * The customer app shows each trip on a photo of its destination (ADR 0020). Job Cards carry no
 * image, so the cover comes from Citius's own destination photos on the website, matched by a
 * word in the trip's destination. A destination with no photo returns null and the app draws its
 * own cover. The path is a website path: the app loads it through the website's image optimizer
 * at the phone's pixel width, after the BlurHash and a tiny preview.
 *
 * Only photos at least about 1,000 px tall are listed: covers crop to portrait on 3x screens, so
 * a smaller source would look soft. Goa, Vietnam and Mussoorie need larger photos before they
 * can be added.
 */
export interface DestinationCover {
  path: string;
  /** BlurHash of the photo's centre, so the app shows its colours before any byte arrives. */
  placeholder: string;
}

const COVERS: readonly (DestinationCover & { words: readonly string[] })[] = [
  {
    path: "/images/event-photo-booth/bali.webp",
    placeholder: "UjHoE?t6V@oKL4NHn~fP?dRlaxj@x^ayaya#",
    words: ["bali", "indonesia", "ubud", "seminyak"],
  },
  {
    path: "/images/event-photo-booth/dubai.webp",
    placeholder: "UaJRwARPjDt7BtM|n#a}x_Rjt7WXRkt7kDj]",
    words: ["dubai", "uae", "abu dhabi", "emirates"],
  },
  {
    path: "/images/event-photo-booth/paris.webp",
    placeholder: "UgKL8mfls-oJK-WFs:WVXVWEazofRjn~jZof",
    words: ["paris", "france"],
  },
  {
    path: "/images/event-photo-booth/kashi.webp",
    placeholder: "UpKKZyR4ngslY8RijDadT2bcWAaekEozbHay",
    words: ["varanasi", "kashi", "banaras", "benaras"],
  },
  {
    path: "/images/event-photo-booth/ayodhya.webp",
    placeholder: "UZJ[6jxuT0ozB@xatRbIX=kCoJbItSj[aJoK",
    words: ["ayodhya"],
  },
  {
    path: "/images/event-photo-booth/kedarnath.webp",
    placeholder: "UgGv9jt7ofxuX;a$j[kC%%R,f6a#tna#oJae",
    words: ["kedarnath", "char dham", "chardham"],
  },
  {
    path: "/gallery/spiritual/golden-kailash.webp",
    placeholder: "UYABO,T2XAt7%%NeWFoJE8V?aeaeE8xXs,Wr",
    words: ["kailash", "mansarovar", "manasarovar", "tibet"],
  },
  {
    path: "/gallery/spiritual/pashupatinath.webp",
    placeholder: "UVIf-qIn73wM-5X9obxD=FR*Nen%}WWUNxn+",
    words: ["kathmandu", "nepal", "pashupatinath"],
  },
  {
    path: "/gallery/account/amalfi-santorini/positano.webp",
    placeholder: "U8CZ9CKmAJtmTh-:-o-pI;^+?b%Mt,tT?ajv",
    words: ["amalfi", "positano", "italy"],
  },
  {
    path: "/gallery/account/amalfi-santorini/santorini.webp",
    placeholder: "UXH_lRRjoft7_1NKbIWB~VR+V@oc?HV@aet7",
    words: ["santorini", "greece"],
  },
  {
    path: "/images/destinations/japan.webp",
    placeholder: "UdJ?$}S$S$t7~VNGRje.GFt7xaofIcjZsmWB",
    words: ["japan", "tokyo", "kyoto", "osaka"],
  },
  {
    path: "/images/destinations/kashmir.webp",
    placeholder: "UPE;f,-;oLtR?w%Loet7xZofaeoLNLWBR*WB",
    words: ["kashmir", "srinagar", "gulmarg", "pahalgam"],
  },
  {
    path: "/images/destinations/kuala-lumpur.webp",
    placeholder: "UYCQrrIAoLf8%jaejuj[4.xbWoWCI=WAfPWC",
    words: ["kuala lumpur", "malaysia"],
  },
  {
    path: "/images/destinations/phuket.webp",
    placeholder: "U~K]_jf*R+j[~BbYWCoLxWkAs:oLX4t6t6j[",
    words: ["phuket", "krabi"],
  },
  {
    path: "/images/destinations/shillong.webp",
    placeholder: "UqDwp%ITkDj[NMt7R*oL?wRiWAofxuWBazae",
    words: ["shillong", "meghalaya"],
  },
  {
    path: "/images/destinations/sri-lanka.webp",
    placeholder: "UxHKCFxtWXae}to2WXjswJaKWXj[NHn%WXWV",
    words: ["sri lanka", "colombo", "kandy"],
  },
  {
    path: "/images/destinations/bangalore.webp",
    placeholder: "USFr#6IUIUtR_N9ZRjt7M|R+oefPoJ%MofRj",
    words: ["bangalore", "bengaluru"],
  },
];

/** A destination photo or null, as the customer app and Citius Connect receive it. */
export const destinationCoverValidator = v.union(
  v.null(),
  v.object({ path: v.string(), placeholder: v.string() })
);

const NON_LETTER = /[^a-z]+/g;

/** The first destination photo whose word appears, as a whole word, in the destination. */
export function destinationCover(destination: string | null | undefined): DestinationCover | null {
  const text = ` ${(destination ?? "").toLowerCase().replace(NON_LETTER, " ")} `;
  for (const cover of COVERS) {
    if (cover.words.some((word) => text.includes(` ${word} `))) {
      return { path: cover.path, placeholder: cover.placeholder };
    }
  }
  return null;
}
