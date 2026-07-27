"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Paperclip, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface CurrencyOption {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  currentRate: number | null;
}

interface CategoryOption {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Belirtilmedi" },
  { value: "CASH", label: "Nakit" },
  { value: "CREDIT_CARD", label: "Kredi Kartı" },
  { value: "BANK_TRANSFER", label: "Banka Havalesi" },
  { value: "AUTOMATIC_PAYMENT", label: "Otomatik Ödeme" },
  { value: "OTHER", label: "Diğer" },
];

const STATUS_OPTIONS = [
  { value: "PAID", label: "Ödendi" },
  { value: "PENDING", label: "Bekliyor" },
  { value: "PARTIALLY_PAID", label: "Kısmen Ödendi" },
  { value: "CANCELLED", label: "İptal Edildi" },
];

// Kullanıcı talebi: "bazı harcamalar kişiye özel, bazıları bize/ekibe özel
// olsun" — bu seçim artık "Ek Bilgiler" içine gizlenmiyor, her kayıtta
// doğrudan görünen, ilk bakışta anlaşılır bir karar (bkz. aşağıdaki
// "Kim Görebilir?" alanı). Etiketler kullanıcının kendi ifadeleriyle
// eşleşecek şekilde sadeleştirildi.
const VISIBILITY_OPTIONS = [
  { value: "OWNER_AND_ADMIN", label: "Kişiye özel — sadece ben ve adminler" },
  { value: "TEAM", label: "Tüm ekiple paylaşılsın" },
  { value: "SPECIFIC_USERS", label: "Seçtiğim kişiler" },
  { value: "DEPARTMENT", label: "İlgili departman" },
  { value: "ADMIN_ONLY", label: "Sadece adminler (ben de görmeyeyim)" },
];

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Haftalık" },
  { value: "MONTHLY", label: "Aylık" },
  { value: "QUARTERLY", label: "3 Aylık" },
  { value: "SEMIANNUAL", label: "6 Aylık" },
  { value: "YEARLY", label: "Yıllık" },
  { value: "CUSTOM", label: "Özel periyot" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface TransactionDetail {
  id: string;
  type: "INCOME" | "EXPENSE";
  transactionDate: string;
  amount: string | number;
  currencyId: string;
  categoryId: string;
  description: string | null;
  personId: string;
  payeeName: string | null;
  paymentMethod: string | null;
  bankAccount: string | null;
  receiptNumber: string | null;
  status: string;
  visibility: string;
  departmentId: string | null;
  visibleUsers: { userId: string }[];
  note: string | null;
  tags: { tag: TagOption }[];
  attachments: { id: string; fileName: string; fileSize: number }[];
}

/**
 * Gelir/gider kayıt ekleme-düzenleme modalı (bkz. proje talebi §2). Zorunlu
 * alanlar üstte, gelişmiş alanlar "Ek Bilgiler" altında açılıp kapanır ki
 * ekran gereksiz uzun görünmesin — kayıt hızlıca girilebilsin.
 */
export function FinanceTransactionModal({
  open,
  onClose,
  onSaved,
  transactionId,
  currentUserId,
  members,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  transactionId: string | null;
  currentUserId: string;
  members: MemberOption[];
  defaultType?: "INCOME" | "EXPENSE";
}) {
  const isEdit = !!transactionId;

  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);

  const [type, setType] = useState<"INCOME" | "EXPENSE">(defaultType ?? "EXPENSE");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [personId, setPersonId] = useState(currentUserId);
  const [payeeName, setPayeeName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [status, setStatus] = useState("PAID");
  const [visibility, setVisibility] = useState("OWNER_AND_ADMIN");
  const [departmentId, setDepartmentId] = useState("");
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [customIntervalDays, setCustomIntervalDays] = useState("30");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/finance/currencies")
      .then((r) => r.json())
      .then((d) => {
        setCurrencies(d.currencies ?? []);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrencyId((prev) => prev || d.currencies?.find((c: CurrencyOption) => c.isBase)?.id || "");
      });
    fetch("/api/finance/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []))
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setAllTags(d.tags ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!transactionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(defaultType ?? "EXPENSE");
      setTransactionDate(todayIso());
      setAmount("");
      setCategoryId("");
      setDescription("");
      setPersonId(currentUserId);
      setPayeeName("");
      setPaymentMethod("");
      setBankAccount("");
      setReceiptNumber("");
      setStatus("PAID");
      setVisibility("OWNER_AND_ADMIN");
      setDepartmentId("");
      setVisibleUserIds([]);
      setNote("");
      setTagIds([]);
      setIsRecurring(false);
      setFrequency("MONTHLY");
      setCustomIntervalDays("30");
      setRecurrenceEndDate("");
      setPendingFile(null);
      setExistingAttachments([]);
      setShowAdvanced(false);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/finance/transactions/${transactionId}`)
      .then((res) => res.json())
      .then((data) => {
        const t: TransactionDetail = data.transaction;
        setType(t.type);
        setTransactionDate(t.transactionDate.slice(0, 10));
        setAmount(String(t.amount));
        setCurrencyId(t.currencyId);
        setCategoryId(t.categoryId);
        setDescription(t.description ?? "");
        setPersonId(t.personId);
        setPayeeName(t.payeeName ?? "");
        setPaymentMethod(t.paymentMethod ?? "");
        setBankAccount(t.bankAccount ?? "");
        setReceiptNumber(t.receiptNumber ?? "");
        setStatus(t.status);
        setVisibility(t.visibility);
        setDepartmentId(t.departmentId ?? "");
        setVisibleUserIds(t.visibleUsers.map((v) => v.userId));
        setNote(t.note ?? "");
        setTagIds(t.tags.map((tt) => tt.tag.id));
        setExistingAttachments(t.attachments ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, transactionId, currentUserId, defaultType]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCurrency = currencies.find((c) => c.id === currencyId);

  function toggleVisibleUser(userId: string) {
    setVisibleUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function toggleTag(tagId: string) {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  async function uploadPendingFile(newTransactionId: string) {
    if (!pendingFile) return;
    const formData = new FormData();
    formData.append("file", pendingFile);
    await fetch(`/api/finance/transactions/${newTransactionId}/attachments`, {
      method: "POST",
      body: formData,
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      return;
    }
    if (!currencyId) {
      setError("Lütfen para birimi seçin.");
      return;
    }
    if (!categoryId) {
      setError("Lütfen kategori seçin.");
      return;
    }
    if (visibility === "SPECIFIC_USERS" && visibleUserIds.length === 0) {
      setError("Belirli kullanıcılar görünürlüğü için en az bir kullanıcı seçin.");
      return;
    }
    if (visibility === "DEPARTMENT" && !departmentId) {
      setError("Departman görünürlüğü için bir departman seçin.");
      return;
    }

    setSaving(true);

    const payload = {
      type,
      transactionDate,
      amount: Number(amount),
      currencyId,
      categoryId,
      description: description || null,
      personId,
      payeeName: payeeName || null,
      paymentMethod: paymentMethod || null,
      bankAccount: bankAccount || null,
      receiptNumber: receiptNumber || null,
      status,
      visibility,
      departmentId: visibility === "DEPARTMENT" ? departmentId : null,
      visibleUserIds: visibility === "SPECIFIC_USERS" ? visibleUserIds : [],
      note: note || null,
      tagIds,
      isRecurring,
      recurrence: isRecurring
        ? {
            frequency,
            customIntervalDays: frequency === "CUSTOM" ? Number(customIntervalDays) || 30 : null,
            endDate: recurrenceEndDate || null,
          }
        : null,
    };

    const res = await fetch(
      isEdit ? `/api/finance/transactions/${transactionId}` : "/api/finance/transactions",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Kayıt kaydedilemedi.");
      setSaving(false);
      return;
    }

    const data = await res.json();
    const savedId = data.transaction?.id ?? transactionId;
    if (savedId) await uploadPendingFile(savedId);

    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteTransaction() {
    if (!transactionId) return;
    await fetch(`/api/finance/transactions/${transactionId}`, { method: "DELETE" });
    setConfirmDeleteOpen(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Kaydı Düzenle" : "Yeni Kayıt Ekle"} wide>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            {(["EXPENSE", "INCOME"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategoryId("");
                }}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                  type === t
                    ? t === "EXPENSE"
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-tint-green-foreground/40 bg-tint-green text-tint-green-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {t === "EXPENSE" ? "Gider" : "Gelir"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">İşlem Tarihi</Label>
              <DatePicker value={transactionDate} onChange={setTransactionDate} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tutar</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Para Birimi</Label>
              <SimpleSelect
                value={currencyId}
                onValueChange={setCurrencyId}
                placeholder="Seçin..."
                options={currencies.map((c) => ({ value: c.id, label: `${c.code} (${c.symbol})` }))}
              />
            </div>
          </div>
          {selectedCurrency && !selectedCurrency.isBase && selectedCurrency.currentRate === null && (
            <p className="text-xs text-tint-amber-foreground">
              {selectedCurrency.code} için tanımlı bir güncel kur yok — admin panelinden kur girilene kadar bu para
              biriminde kayıt oluşturulamaz.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <SimpleSelect
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Kategori seçin..."
                options={filteredCategories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {type === "EXPENSE" ? "Harcamayı Yapan Kişi" : "İlgili Kişi"}
              </Label>
              <SimpleSelect
                value={personId}
                onValueChange={setPersonId}
                options={members.map((m) => ({ value: m.id, label: m.name || m.email }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Açıklama</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
            <Label className="text-xs font-medium text-foreground/90">Kim Görebilir?</Label>
            <SimpleSelect value={visibility} onValueChange={setVisibility} options={VISIBILITY_OPTIONS} />

            {visibility === "SPECIFIC_USERS" && (
              <div className="space-y-1.5 pt-1.5">
                <Label className="text-xs text-muted-foreground">Görebilecek Kullanıcılar</Label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const active = visibleUserIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleVisibleUser(m.id)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground/80 hover:border-primary/50",
                        )}
                      >
                        {m.name || m.email}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {visibility === "DEPARTMENT" && (
              <div className="space-y-1.5 pt-1.5">
                <Label className="text-xs text-muted-foreground">Departman</Label>
                <SimpleSelect
                  value={departmentId}
                  onValueChange={setDepartmentId}
                  placeholder="Departman seçin..."
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            Ek Bilgiler
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ödemeyi Alan Kişi / Firma</Label>
                  <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Örn. ABC Ltd. Şti." />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ödeme Yöntemi</Label>
                  <SimpleSelect value={paymentMethod} onValueChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">İlgili Banka / Hesap</Label>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fatura / Fiş Numarası</Label>
                  <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Belge (fiş / fatura)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {existingAttachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/finance/transactions/${transactionId}/attachments/${a.id}/download`}
                      className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground/80 hover:border-primary/50"
                    >
                      <Paperclip className="h-3 w-3" /> {a.fileName}
                    </a>
                  ))}
                  {pendingFile && (
                    <span className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      <Paperclip className="h-3 w-3" /> {pendingFile.name}
                      <button type="button" onClick={() => setPendingFile(null)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <label className="cursor-pointer rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
                    + Belge yükle
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                      className="hidden"
                      onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Harcamanın Durumu</Label>
                  <SimpleSelect value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Tekrarlayan İşlem</Label>
                  <button
                    type="button"
                    onClick={() => setIsRecurring((v) => !v)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      isRecurring ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                        isRecurring ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
                {isRecurring && (
                  <div className="grid gap-3 pt-1 sm:grid-cols-3">
                    <SimpleSelect value={frequency} onValueChange={setFrequency} options={FREQUENCY_OPTIONS} />
                    {frequency === "CUSTOM" && (
                      <Input
                        type="number"
                        min={1}
                        value={customIntervalDays}
                        onChange={(e) => setCustomIntervalDays(e.target.value)}
                        placeholder="Gün sayısı"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs text-muted-foreground">Bitiş (opsiyonel)</Label>
                      <DatePicker value={recurrenceEndDate} onChange={setRecurrenceEndDate} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Etiketler</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground/80 hover:border-primary/50",
                        )}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && <span className="text-xs text-muted-foreground">Henüz etiket yok.</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Not</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                Kaydı Sil
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        description="Bu finans kaydını silmek istediğinize emin misiniz?"
        onConfirm={deleteTransaction}
      />
    </Modal>
  );
}
