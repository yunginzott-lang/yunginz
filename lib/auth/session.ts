import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";

export async function requireAdmin() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  return session;
}
