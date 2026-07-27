"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { contentStatusLabels } from "@/lib/utils";
import { BlogContentList } from "@/components/content/blog-content-list";
import { BlogContentModal } from "@/components/content/blog-content-modal";
import type { ContentPermissionSet } from "@/lib/content-permissions";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}
interface BrandOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [{ value: "", label: "Tüm durumlar" }, ...Object.entries(contentStatusLabels).map(([value, label]) => ({ value, label }))];

export function BlogContentView({
  currentUserId,
  members,
  brands,
  permissions,
  isAdmin,
}: {
  currentUserId: string;
  members: MemberOption[];
  brands: BrandOption[];
  permissions: ContentPermissionSet;
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [personId, setPersonId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const personOptions = [{ value: "", label: "Herkes" }, ...members.map((m) => ({ value: m.id, label: m.name || m.email }))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
        <SimpleSelect value={status} onValueChange={setStatus} options={STATUS_OPTIONS} triggerClassName="w-40" />
        <SimpleSelect value={personId} onValueChange={setPersonId} options={personOptions} triggerClassName="w-40" />
        <div className="flex-1" />
        {permissions.canCreateContent && (
          <Button
            onClick={() => {
              setEditingId(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Yeni Blog İçeriği
          </Button>
        )}
      </div>

      <BlogContentList
        filters={{ search, status, personId }}
        refreshKey={refreshKey}
        onEdit={(id) => {
          setEditingId(id);
          setModalOpen(true);
        }}
      />

      <BlogContentModal
        open={modalOpen}
        contentId={editingId}
        currentUserId={currentUserId}
        members={members}
        brands={brands}
        permissions={permissions}
        isAdmin={isAdmin}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
