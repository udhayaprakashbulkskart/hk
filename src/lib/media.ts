/** Transparent character / weapon renders used as site art (public/media/skins). */
export const RENDERS = {
  goldenSeraph: "/media/skins/outfit-golden-seraph.webp",
  abyssalDragon: "/media/skins/outfit-abyssal-dragon.webp",
  pharaohGold: "/media/skins/outfit-pharaoh-gold.webp",
  crimsonGambler: "/media/skins/outfit-crimson-gambler.webp",
  ravenKnight: "/media/skins/outfit-raven-knight.webp",
  blossomEmpress: "/media/skins/outfit-blossom-empress.webp",
  skullRider: "/media/skins/outfit-skull-rider.webp",
  signedMummy: "/media/skins/outfit-signed-mummy.webp",
  tridentWarden: "/media/skins/outfit-trident-warden.webp",
  moltenAkm: "/media/skins/gun-molten-akm.webp",
  dragonfireSmg: "/media/skins/gun-dragonfire-smg.webp",
  celestialRifle: "/media/skins/gun-celestial-rifle.webp",
  frostbiteRifle: "/media/skins/gun-frostbite-rifle.webp",
  scarecrowAkm: "/media/skins/gun-scarecrow-akm.webp",
} as const;

/** Category → showcase render (categories without one fall back to an icon). */
export const CATEGORY_RENDER: Record<string, string | undefined> = {
  "weapon-skins": RENDERS.moltenAkm,
  outfits: RENDERS.ravenKnight,
  "mythic-sets": RENDERS.pharaohGold,
  helmets: RENDERS.skullRider,
};
