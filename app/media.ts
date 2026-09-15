// Directly hosted media selected from the studio's public Instagram collaborations.
// Audio tracks are removed from every MP4. Source links are attribution, never embeds.
export const studioMedia = {
  hero: { src: "/media/studio.mp4", poster: "/media/studio-poster.webp", source: "https://www.instagram.com/cheo_barber1/reel/Dc3kNHzg8hs/" },
  cut: { src: "/media/signature-cut.mp4", poster: "/media/signature.webp", source: "https://www.instagram.com/cheo_barber1/reel/DcJIfm-R3x-/" },
  ritual: { src: "/media/ritual.mp4", poster: "/media/ritual-poster.webp", source: "https://www.instagram.com/jotaemebarberstudio/reel/Dcopsm4zWog/" },
};
export const portfolio: Array<{image:string;video?:string;poster?:string;es:string;en:string;detailEs:string;detailEn:string;service:string}> = [
  { image: "/media/signature.webp", es: "Líneas definidas", en: "Defined lines", detailEs: "Degradado y acabado preciso", detailEn: "Fade and precise finishing", service: "haircut" },
  { image: "/media/texture-poster.webp", video: "/media/texture.mp4", poster: "/media/texture-poster.webp", es: "Textura y carácter", en: "Texture and character", detailEs: "Un estilo hecho para ti", detailEn: "A style made for you", service: "haircut" },
  { image: "/media/detail.webp", es: "Cada detalle cuenta", en: "Every detail matters", detailEs: "El proceso Jota Eme", detailEn: "The Jota Eme process", service: "haircut" },
];
