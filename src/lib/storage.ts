import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Yerel disk depolama katmanı
//
// Dosyalar, docker-compose'daki `uploads_data` volume'üne bağlanan
// `UPLOADS_DIR` altında saklanır. İleride bulut depolamaya (S3 vb.) geçiş
// gerekirse yalnızca bu dosyanın değişmesi yeterli olacak şekilde tüm
// modüller (FileUpload, TaskAttachment) bu katmanı kullanır.
// ---------------------------------------------------------------------------

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/** Bir dosyayı diske kaydeder, benzersiz depolama yolunu döner. */
export async function saveFile(file: File): Promise<{
  storedPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  await ensureUploadsDir();

  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOADS_DIR, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return {
    storedPath: storedName,
    fileName: file.name,
    fileSize: buffer.byteLength,
    mimeType: file.type || "application/octet-stream",
  };
}

/** Diskteki dosyayı okur (indirme uç noktaları için). */
export async function readStoredFile(storedPath: string): Promise<Buffer> {
  const fullPath = path.join(UPLOADS_DIR, storedPath);
  return readFile(fullPath);
}

/** Diskteki dosyayı siler; dosya zaten yoksa sessizce geçer. */
export async function deleteStoredFile(storedPath: string): Promise<void> {
  const fullPath = path.join(UPLOADS_DIR, storedPath);
  try {
    await unlink(fullPath);
  } catch {
    // dosya zaten silinmiş olabilir — yoksayılır
  }
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
