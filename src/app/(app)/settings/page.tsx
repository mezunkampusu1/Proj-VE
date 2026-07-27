import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { ManageTags } from "@/components/tags/manage-tags";
import { ManageUniversities } from "@/components/universities/manage-universities";
import { ManageInstitutes } from "@/components/atlas/manage-institutes";
import { ContentAdminPanel } from "@/components/content/content-admin-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function SettingsPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);
  const isAdmin = membership?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Çalışma alanı genelinde kullanılan ortak ayarlar.
        </p>
      </div>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          {/* İçerik modülü ayarları (Markalar + Yetkiler) — eskiden ayrı bir
              /content/settings sayfasıydı, tek Ayarlar ekranı altında
              toplanması için buraya taşındı. Yalnızca ADMIN görür, tıpkı eski
              sayfanın kendi kilidinde olduğu gibi (bkz. ContentAdminPanel). */}
          {isAdmin && <TabsTrigger value="content">İçerik</TabsTrigger>}
        </TabsList>
        <TabsContent value="general" className="space-y-6">
          <ManageTags isAdmin={isAdmin} />
          <ManageUniversities isAdmin={isAdmin} />
          <ManageInstitutes isAdmin={isAdmin} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="content">
            <ContentAdminPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
