import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:"*",allow:"/",disallow:["/admin","/api/"]},sitemap:"https://jota-eme-studio-cartagena.sites.chatgpt.com/sitemap.xml"}}
