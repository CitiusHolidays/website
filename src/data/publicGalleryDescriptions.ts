// Existing public Gallery assets visually reviewed on 8 September 2026.
// Keep CMS descriptions authoritative when an editor supplies them.
const descriptions = {
  "image-0a399980ab5715c7ff6140dcc4b2e181bba33114-3024x4032-jpg":
    "Coconuts and red flowers arranged on a palm leaf.",
  "image-0cdacdba7cb8d8bf0d90218161ffeb78bb5140b6-2268x4032-jpg":
    "Rows of layered desserts in glasses on a serving counter.",
  "image-0ec576c8088f15d9bde6d0ea88f8b6a7f96a92e8-4032x2268-jpg":
    "An empty event stage with blue screens and rows of chairs.",
  "image-0fb3c201d834bfd3ddf75470218be3a847e0abb7-2268x4032-jpg":
    "Workshop participants in purple shirts and chef hats gathered around a table.",
  "image-1b716076db023b7b037e36c7fadb5e50e0edc623-2793x3324-jpg":
    "A plated dish topped with sliced chillies, herbs, and an edible flower.",
  "image-1c31fcb796efff0a60ec7c2102b0dc062f7215b8-2769x3118-png":
    "Group holding an Indian flag in front of India Gate.",
  "image-2e91acf4603a0c3520737577e5e20d32f479bf0c-4160x2773-png":
    "Group dressed in green robes seated on stone temple steps.",
  "image-2fd1cf30f4c7f96b661324f481b09c8869daebde-2268x4032-jpg":
    "A carved stone wheel set into the wall of a temple.",
  "image-3b11fc95ba013af0e2c302381bf79b755addbf5b-3712x2877-png":
    "A singer and musicians performing under red and white stage lights.",
  "image-4ae30e9e139fd9c85b96b6cf7231bc236de13377-2268x4032-jpg":
    "People walking toward hot-air balloons being inflated in a field.",
  "image-4b4b4510debb130aefef52d5d3374dcdd53efa30-4032x3024-png":
    "Group holding Indian flags outside a sports venue.",
  "image-4c67cd0d91a20b2e543cc86f40f3059875d390c7-3024x4032-jpg":
    "A participant in a chef hat decorating a rectangular cake.",
  "image-4c60851fd7ebfb1dd6a9f98dd570075c01a945ca-3596x1978-jpg":
    "Group in aprons and chef hats raising their hands in a kitchen workshop.",
  "image-4d31865e0802401cc17fda60d546afb9e72ef689-3024x4032-jpg":
    "A pale wooden building extending over calm water at sunset.",
  "image-5a26a151f19ba0af0d261502c9898d305b18b064-1236x1280-png":
    "Group holding a Dubai MICE Star Awards silver-winner certificate.",
  "image-5dc6d5197969a6aa36db4ac3842a3ec5b0e6867f-4032x3024-png":
    "Large group in white shirts gathered on a lawn outside a hotel.",
  "image-8f2ea2626b0dece38944fc09e3dc46659db9a594-2268x4032-jpg":
    "A chef plating food beside bowls of prepared ingredients.",
  "image-9b69e220ad982be3665687ab2866cab2c9909512-4032x3024-png":
    "Group in colourful turbans posing on a ballroom stage.",
  "image-9c1ca0c7722b232559f0dcf28368702674ff24e5-3024x4032-jpg":
    "Bottles and glasses set beside the sea at sunset.",
  "image-05ec5371b46ce57b7aa437fa8672d9ebb7127b5b-4032x3024-png":
    "Three wine glasses on a wooden table beside a terrace.",
  "image-09de914ec6a7e41c9b0fe60910338b8061058b6d-2268x4032-jpg":
    "Banquet tables and tall candle arrangements beneath purple ceiling lights.",
  "image-19b60715f17c372205fe0b073d0c38a8911e50b0-3672x2066-jpg":
    "A large group in pale shirts gathered on a green sports field.",
  "image-24e6d8500eabfcff4fa87fa7a335974ef69e031f-4032x2268-jpg":
    "An audience watching a group presentation on an illuminated event stage.",
  "image-32a1732ee67b26ac392d26d00c2cb7947694ebbd-2268x4032-jpg":
    "Two guests posing inside a colourful event photo booth.",
  "image-44be67bff383fa984b6e2f45e1bb5aedf301470c-2186x3886-jpg":
    "A red tram travelling along a cobbled street between colourful buildings.",
  "image-78f2d7aea4758c1fdc1c2c32b1e967668ff6e450-3024x4032-jpg":
    "Passengers in a small boat looking out through a sea cave.",
  "image-79a8ea81e3f6a5e78203dffd3e88c0f306016b1c-4160x2773-png":
    "A person holding a smoking ceremonial lamp before a seated gathering.",
  "image-82f216708513b53ef90ea9ceaa1116d7fbf418af-3024x4032-jpg":
    "Eyewear display tables beside large spectacle advertising posters.",
  "image-93a7ef3759bbcedbd7962aac3f2c6a1ea52d71e6-3024x4032-jpg":
    "A lantern hanging above a green pond under leafy branches.",
  "image-051dbeb01768ec4a639dac86379fd1b568b77fdc-2039x2518-jpg":
    "People relaxing on a waterside deck outside a yellow building.",
  "image-218d17a22d8ffb96f118e6d6c5d880285307632f-1934x2578-png":
    "Three men posing together inside a building.",
  "image-250f8000a5da7201598fcd69d6e176afda6a4f74-2268x4032-jpg":
    "A restaurant table set beside an open terrace and a pink building.",
  "image-318bf758e9d311e1a815157a25e9ca099a267de4-3024x4032-jpg":
    "A bowl of green curry garnished with basil and red chilli.",
  "image-399da622a84931e7e9abdca1b27ea890a9a73e02-3024x4032-jpg":
    "Two people on a red-lit stage beside a drawing board.",
  "image-686c6e64e3b26f7e4eede8639b3b049c7e534748-3024x4032-jpg":
    "A view of an airport runway and aircraft wing from a passenger window.",
  "image-745c8d4dfe11cc3c0f7ebab07401aacedb45572f-4032x2268-jpg":
    "A large group in purple shirts gathered on a lawn beside a stone temple.",
  "image-833c016f752c271ddf05b0ddd0a5c8d5d8f0e8ce-3024x4032-png":
    "Travellers holding an Indian flag near the Eiffel Tower.",
  "image-916abdf5ecf712cfc10d7b7796c611d356fea3e5-3024x4032-png":
    "Travellers gathered on steps below a white domed church.",
  "image-2965a8c7d491025f219259d3dc51dda5b171a77f-4032x3024-png":
    "Group in green shirts raising their arms beside a high-rise building.",
  "image-4636f3b9d11adb5efde5e6fddf23e82ab095dbae-3744x2496-jpg":
    "Cooking workshop participants gathered around a person speaking into a microphone.",
  "image-9192b9a1a905ddcfd330346b2abbb98d9521ab9b-3024x4032-png":
    "Spectators overlooking a blue hockey pitch from the stands.",
  "image-64761deb60bbc8bd1277e68f581f11eb45467a81-4032x3024-png":
    "A speaker on a stage with a stand-up comedy backdrop and red curtains.",
  "image-72954c8b47b7ca4e9d85b43c0b89c5460644c84f-3024x4032-png":
    "A banknote held in front of a courtyard pond and pavilion.",
  "image-92567dec6a47e81af14e71d0f1105a8a1125d59f-3024x4032-jpg":
    "A narrow opening through sunlit coastal rock.",
  "image-97091be6478d71a3810b562b58d97e83fe8bbb71-3024x4032-jpg":
    "Small sailboats resting on a sandy beach beside clear water.",
  "image-137503b35251fe1b74c44d94dfd57e720fcb6f3d-3024x3236-png":
    "A cannon firing above a harbour lined with stone buildings.",
  "image-8816157a67d002d623a281648d9c1b757f6c89b3-2268x4032-jpg":
    "Passengers on a sailing boat moored in a harbour.",
  "image-a20366030d53313d3ef7446fca3611a1857152b7-4032x3024-png":
    "Two visitors beside a Glacier 3000 sign below a snowy mountain ridge.",
  "image-aa0bcfd1095c47d3c4218ef4221ba42247ddfe03-3672x2066-jpg":
    "Outdoor performers in yellow shirts with drums.",
  "image-b8c5379bec8d9634d4228d5baa34a8adbf89fa07-2160x3840-png":
    "Fire performers surrounded by spectators in an outdoor amphitheatre.",
  "image-b05a590adf5dee211d8012dbc5f0db86760376e9-3024x3321-jpg":
    "A woman smiling at an outdoor caf\u00e9 table.",
  "image-b5753d5d53980ca3b1c6b3d72e74b89281d2e0b8-2268x4032-jpg":
    "A dining table laid with bread, vegetables, plates, and glasses.",
  "image-bdf91ef6c5abde0a8e1a58d202d6280e99b8b3f7-3024x4032-jpg":
    "A participant in a tall chef hat arranging food on a plate.",
  "image-c1c382da270b4be7f7776602baeaf086fbd6eba1-2964x3024-jpg":
    "People seated on touring motorcycles along a tree-lined street.",
  "image-c4efb516037b0ba06e045fefdbd8a13b89a6b90d-3024x3743-jpg":
    "Small bowls of chopped ingredients arranged around a pink flower garnish.",
  "image-c01b3183a57e746234f98a4c225d560b6063d073-3660x2898-jpg":
    "Travellers posing beside a rocky coastal cliff.",
  "image-c91e6d215ca3af1946aa5481d02a1a9f6768765d-3475x2548-jpg":
    "A speaker at a lectern in front of a large historical scene on screen.",
  "image-c967f56a7d5949abd802f567205f1798c2b829c0-2590x3642-png":
    "A Ferris wheel silhouetted against an orange sunset.",
  "image-c980aced4a6a0778a6ccec63f9f7fef9b942db68-3744x2496-jpg":
    "Five cooking workshop participants presenting a plated dish.",
  "image-ca42b6664c33e6c4beb8bd388bab612ec2c00b8c-2875x3109-jpg":
    "A performer on stage in front of a screen reading Suhani Shah.",
  "image-ceca4c45cec801a8c1695e164f7152a7e0af1759-3024x4032-png":
    "Guests gathered around a decorated arch overlooking a harbour.",
  "image-cf48e9af48d69e689125f4255af26387230e42b5-3024x4032-jpg":
    "Rice served in a hollowed pineapple with fruit and lime.",
  "image-d0e6f60bf81ecb2171e335a6686c21a98c017dd6-4032x3024-jpg":
    "Guests seated beneath crossing beams of light in a large event hall.",
  "image-d26f96362914a108248c3ef8d26cb982d4a8f7cc-3651x2053-jpg":
    "An event photo backdrop with Vietnam scenery and an I love Hanoi sign.",
  "image-db143c91b3fa75528e1f906caf83dee592bda59e-3024x4032-jpg":
    "Workshop participants decorating a cake together.",
  "image-e04d30a8ba6bd45a1a3abb4d43236404cc718082-3024x4032-jpg":
    "Golden fried snacks garnished with herbs on a black plate.",
  "image-e82b132881c00b75ed200f7e3f3ddb704b429dec-2593x2671-png":
    "The Taj Mahal viewed through a dark archway.",
  "image-e7202de3c81bc123ad70f2d2004161f0120ffe53-4032x2268-jpg":
    "A group on stage in front of a conference presentation screen.",
  "image-ec4cc9939fc0df494461e104306ed423d696d8b6-4032x2268-jpg":
    "Audience seated beneath curved ceiling lights facing a presentation screen.",
  "image-f0a2243ac658a1ca3dc41d964a01542d4565495a-3024x4032-jpg":
    "A natural rock arch above blue seawater.",
  "image-f5cc2c9f6510e030ac85bf46b0974571f459a73f-3744x2496-jpg":
    "Participants in aprons and chef hats taking part in a group activity.",
  "image-f56db0ac6b4d193018bdbc901da9e5602322fe98-4032x3024-png":
    "Group seated in a grandstand overlooking a motor racing circuit.",
  "image-f7688225ae9ec8b330e7b1630f9ae6498cc5ab14-4032x2365-jpg":
    "Group posing together in front of an event backdrop.",
  "image-fbef5fa38af29b03195de4e8be71f8f10c673675-4032x3024-png":
    "Audience facing a wide red-lit stage in a conference hall.",
  "image-fee252ddfa00cd29e545f0b193e043aa67a031ad-3798x2818-jpg":
    "Audience watching a speaker on a wide stage with red screens.",
} satisfies Readonly<Record<string, string>>;

export function getPublicGalleryDescription(image: {
  alt?: string | null;
  asset?: { _id?: string };
}): string {
  const assetId = image.asset?._id;
  // SAFETY: Object.hasOwn verifies the asset ID is a key of this reviewed description table.
  return (
    image.alt?.trim() ||
    (assetId && Object.hasOwn(descriptions, assetId)
      ? descriptions[assetId as keyof typeof descriptions]
      : "")
  );
}
