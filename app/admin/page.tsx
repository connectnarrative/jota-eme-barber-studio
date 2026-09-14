import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { AdminDashboard } from "./admin-client";
export const dynamic="force-dynamic";
export default async function AdminPage(){
  if (!(await isAdminAuthorized())) redirect("/admin/login");
  const email=(await headers()).get("cf-access-authenticated-user-email");
  return <AdminDashboard userName={email??"Administración Jota Eme"}/>;
}
