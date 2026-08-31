import { PUBLIC_DESTINATIONS } from "@/data/publicDestinations";
import Bangalore from "@/static/places/bangalore.webp";
import Goa from "@/static/places/goa.webp";
import Japan from "@/static/places/japan.webp";
import Kashmir from "@/static/places/kashmir.webp";
import KualaLumpur from "@/static/places/kuala-lumpur.webp";
import Mussoorie from "@/static/places/mussoorie.webp";
import Phuket from "@/static/places/phuket.webp";
import Shillong from "@/static/places/shillong.webp";
import SriLanka from "@/static/places/sri-lanka.webp";
import Vietnam from "@/static/places/vietnam.webp";

const destinationImages = {
  bangalore: Bangalore,
  goa: Goa,
  japan: Japan,
  kashmir: Kashmir,
  "kuala-lumpur": KualaLumpur,
  mussoorie: Mussoorie,
  phuket: Phuket,
  shillong: Shillong,
  "sri-lanka": SriLanka,
  vietnam: Vietnam,
};

function withImages(destinations) {
  return destinations.map((destination) => ({
    ...destination,
    image: destinationImages[destination.id],
  }));
}

export const internationalDestinations = withImages(
  PUBLIC_DESTINATIONS.filter(({ region }) => region === "international")
);
export const domesticDestinations = withImages(
  PUBLIC_DESTINATIONS.filter(({ region }) => region === "domestic")
);
