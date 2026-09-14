import { requireChatGPTUser, chatGPTSignOutPath, cloudflareAccessSignOutPath } from "../chatgpt-auth";
import { AdminDashboard } from "./admin-client";
export const dynamic="force-dynamic";
export default async function AdminPage(){const user=await requireChatGPTUser("/admin");const signOutPath=user.userId.startsWith("cloudflare:")?cloudflareAccessSignOutPath("/"):chatGPTSignOutPath("/");return <AdminDashboard userName={user.fullName??user.email} signOutPath={signOutPath}/>}
