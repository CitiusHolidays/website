export type PublicOfficeSurface = "contact" | "footer";

export interface PublicOffice {
  address: Record<PublicOfficeSurface, string>;
  city: "Bengaluru" | "Kolkata" | "Mumbai";
  dialPhone: string;
  displayPhone: string;
  id: "bengaluru" | "kolkata" | "mumbai";
  mapEmbedUrl: string;
}

const PUBLIC_OFFICES = {
  bengaluru: {
    address: {
      contact:
        "Pachie's 3rd Floor, Building Number: 982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043",
      footer:
        "Pachie's 3rd Floor\nBuilding Number: 982\n3rd Cross Road\nKalyan Nagar\nBengaluru 560043",
    },
    city: "Bengaluru",
    dialPhone: "+919900814292",
    displayPhone: "+91 99008 14292",
    id: "bengaluru",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.265385803619!2d77.6521246!3d13.0187647!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae170035730c9f%3A0xc369a6eb1011ce3c!2sPachies!5e0!3m2!1sen!2sin!4v1751708405258!5m2!1sen!2sin",
  },
  kolkata: {
    address: {
      contact: "1865, Rajdanga Main Rd, Rajdanga, Kasba, Kolkata, West Bengal 700107",
      footer: "207, The Chambers, 1865 Rajdanga\nMain Road Kolkata, West\nBengal 700107",
    },
    city: "Kolkata",
    dialPhone: "+919831082929",
    displayPhone: "+91 98310 82929",
    id: "kolkata",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7371.453129369134!2d88.38764907014604!3d22.514440031478962!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a02715301f75725%3A0xf1aa2145e95e1dca!2sCitius%20Holidays%20Private%20Limited!5e0!3m2!1sen!2sin!4v1752329121013!5m2!1sen!2sin",
  },
  mumbai: {
    address: {
      contact: "214 Swastik Plaza, Pokhran Road No 2, Thane West 400610",
      footer: "214 Swastik Plaza\nPokhran Road No 2\nThane West 400610",
    },
    city: "Mumbai",
    dialPhone: "+919920993259",
    displayPhone: "+91 9920993259",
    id: "mumbai",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.508557808548!2d72.972286!3d19.2166556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b9424c041a6b%3A0x25adaf1c8857d238!2sSwastik%20Plaza!5e0!3m2!1sen!2sin!4v1751708328548!5m2!1sen!2sin",
  },
} as const satisfies Record<PublicOffice["id"], PublicOffice>;

const PUBLIC_OFFICE_ORDER = {
  contact: ["kolkata", "mumbai", "bengaluru"],
  footer: ["mumbai", "bengaluru", "kolkata"],
} as const satisfies Record<PublicOfficeSurface, readonly PublicOffice["id"][]>;

export function getPublicOffices(surface: PublicOfficeSurface): readonly PublicOffice[] {
  return PUBLIC_OFFICE_ORDER[surface].map((officeId) => PUBLIC_OFFICES[officeId]);
}
