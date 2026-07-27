"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, priorityTone } from "@/components/ui/badge";
import { priorityLabel } from "@/lib/utils";

interface GeneratedTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export function AiGenerateTasksModal({
  open,
  onClose,
  onCreated,
  projectId,
  scheduledDate,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: string;
  scheduledDate?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPrompt("");
    setTasks([]);
    setSelected(new Set());
    setError(null);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/generate-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, projectId }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Görevler üretilemedi.");
      return;
    }

    const data = await res.json();
    setTasks(data.tasks);
    setSelected(new Set(data.tasks.map((_: GeneratedTask, i: number) => i)));
  }

  function toggle(i: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function createSelected() {
    setCreating(true);
    const toCreate = tasks.filter((_, i) => selected.has(i));

    for (const task of toCreate) {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          priority: task.priority,
          scheduledDate,
        }),
      });
    }

    setCreating(false);
    reset();
    onCreated();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Yapay Zeka ile Görev Oluştur"
      wide
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Ne yapılması gerektiğini kendi cümlelerinizle anlatın</Label>
          <Textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn. Yeni müşteri onboarding sürecini kuracağız: önce form tasarlanacak, sonra hoş geldin e-postası akışı hazırlanacak, son olarak CRM'e entegre edilecek."
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end">
          <Button onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? "Üretiliyor..." : "Görev Önerileri Üret"}
          </Button>
        </div>

        {tasks.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground/90">
              Önerilen görevler — eklemek istediklerinizi seçin
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {tasks.map((task, i) => (
                <label
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <Badge tone={priorityTone(task.priority)}>
                        {priorityLabel(task.priority)}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={createSelected} disabled={creating || selected.size === 0}>
                {creating
                  ? "Ekleniyor..."
                  : `Seçilenleri Ekle (${selected.size})`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
