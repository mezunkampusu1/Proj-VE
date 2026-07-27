import { prisma } from "@/lib/prisma";
import type { DocumentAuditAction } from "@prisma/client";

interface LogDocumentAuditInput {
  documentId?: string | null;
  documentTitleSnapshot: string;
  actorId: string;
  action: DocumentAuditAction;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  description?: string | null;
  ipAddress?: string | null;
}

/**
 * Ortak Alan'a özgü, yalnızca yöneticilerin görebildiği denetim kaydı
 * (bkz. §22 — genel ActivityLog akışından AYRI tutulur, çünkü normal
 * kullanıcılara asla gösterilmemesi gerekir).
 */
export async function logDocumentAudit(input: LogDocumentAuditInput) {
  return prisma.documentAuditLog.create({
    data: {
      documentId: input.documentId ?? undefined,
      documentTitleSnapshot: input.documentTitleSnapshot,
      actorId: input.actorId,
      action: input.action,
      field: input.field ?? undefined,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      description: input.description ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}
