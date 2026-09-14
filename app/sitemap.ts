import type {MetadataRoute} from "next";
export default function sitemap():MetadataRoute.Sitemap{const base="https://jota-eme-studio-cartagena.sites.chatgpt.com";return[{url:base,changeFrequency:"weekly",priority:1},{url:`${base}/services`,changeFrequency:"weekly",priority:.8}]}
