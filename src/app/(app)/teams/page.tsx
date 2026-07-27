import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";

/**
 * Sistem tek çalışma alanı (workspace) prensibiyle çalışır — kullanıcıya
 * takım seçtirilmez. Bu route geriye dönük uyumluluk için tutulur ve
 * doğrudan workspace'in "Görevler" (proje listesi) sayfasına yönlendirir.
 */
export default async function TeamsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await getOrCreateWorkspaceTeam(session.user.id);
  redirect(`/teams/${workspace.id}`);
}
