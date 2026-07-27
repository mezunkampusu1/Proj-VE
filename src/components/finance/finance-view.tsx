"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { FinanceList } from "@/components/finance/finance-list";
import { FinanceReportsView } from "@/components/finance/finance-reports-view";
import { FinanceTransactionModal } from "@/components/finance/finance-transaction-modal";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}
interface CategoryOption {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}
interface CurrencyOption {
  id: string;
  code: string;
  symbol: string;
}

export function FinanceView({
  currentUserId,
  members,
  isAdmin,
}: {
  currentUserId: string;
  members: MemberOption[];
  isAdmin?: boolean;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/finance/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
    fetch("/api/finance/currencies")
      .then((r) => r.json())
      .then((d) => setCurrencies(d.currencies ?? []));
  }, [refreshKey]);

  function openCreate() {
    setEditingId(null);
    setModalOpen(true);
  }
  function openEdit(id: string) {
    setEditingId(id);
    setModalOpen(true);
  }
  function onSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <Tabs defaultValue="overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="records">Kayıtlar</TabsTrigger>
          <TabsTrigger value="reports">Raporlar</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button type="button" variant="secondary" asChild>
              <Link href="/finance/admin">
                <Settings className="mr-1.5 h-4 w-4" />
                Yönetim
              </Link>
            </Button>
          )}
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Yeni Kayıt Ekle
          </Button>
        </div>
      </div>

      <TabsContent value="overview">
        <FinanceOverview refreshKey={refreshKey} />
      </TabsContent>

      <TabsContent value="records">
        <FinanceList onEdit={openEdit} members={members} categories={categories} currencies={currencies} refreshKey={refreshKey} />
      </TabsContent>

      <TabsContent value="reports">
        <FinanceReportsView />
      </TabsContent>

      <FinanceTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
        transactionId={editingId}
        currentUserId={currentUserId}
        members={members}
      />
    </Tabs>
  );
}
