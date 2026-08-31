/**
 * storage.upload.ts — Upload de imagens local (disco do servidor)
 * Salva em /var/data/ideal-prime/uploads e serve via Express em /uploads/
 */

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/var/data/ideal-prime/uploads";
const PUBLIC_BASE_URL = process.env.APP_URL ?? "http://localhost:4000";
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_DOCUMENT_MIME_TYPES = [...ALLOWED_MIME_TYPES, "application/pdf"];
const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
];
const MAX_FILE_SIZE_MB = 5;
const MAX_AUDIO_FILE_SIZE_MB = 16;

// Garante que o diretório existe
function ensureUploadDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildFilename(productId: number, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `product_${productId}_${uid}${ext}`;
}

function buildPublicUrl(filename: string): string {
  return `${PUBLIC_BASE_URL}/uploads/${filename}`;
}

// Upload direto (buffer) — usado pelo servidor
export async function uploadProductImageBuffer(
  productId: number,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Tipo não permitido: ${mimeType}. Use JPEG, PNG, WebP ou GIF.`
    );
  }
  if (fileBuffer.byteLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Imagem deve ter no máximo ${MAX_FILE_SIZE_MB}MB.`);
  }

  const dir = path.join(UPLOAD_DIR, String(productId));
  ensureUploadDir(dir);

  const filename = buildFilename(productId, originalFilename);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, fileBuffer);

  return buildPublicUrl(`${productId}/${filename}`);
}

export async function uploadDocumentBuffer(
  folder: string,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Tipo de documento não permitido: ${mimeType}. Use JPEG, PNG, WebP, GIF ou PDF.`
    );
  }
  if (fileBuffer.byteLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Documento deve ter no máximo ${MAX_FILE_SIZE_MB}MB.`);
  }

  const safeFolder = folder
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
  if (!safeFolder) throw new Error("Pasta de upload inválida");
  const privateRoot = path.join(process.env.DATA_DIR ?? "/var/data/ideal-prime", "private");
  const dir = path.join(privateRoot, safeFolder);
  ensureUploadDir(dir);
  const ext =
    path.extname(originalFilename).toLowerCase() ||
    (mimeType === "application/pdf" ? ".pdf" : ".jpg");
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const filename = `document_${uid}${ext}`;
  fs.writeFileSync(path.join(dir, filename), fileBuffer);
  return `${PUBLIC_BASE_URL}/api/private-files/${encodeURIComponent(safeFolder)}/${encodeURIComponent(filename)}`;
}

export async function uploadAudioBuffer(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  if (!ALLOWED_AUDIO_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Tipo de áudio não permitido: ${mimeType}. Use WebM, MP3, WAV, OGG ou M4A.`
    );
  }
  if (fileBuffer.byteLength > MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Áudio deve ter no máximo ${MAX_AUDIO_FILE_SIZE_MB}MB.`);
  }

  const dir = path.join(UPLOAD_DIR, "audio");
  ensureUploadDir(dir);
  const ext = path.extname(originalFilename).toLowerCase() || ".webm";
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const filename = `voice_${uid}${ext}`;
  fs.writeFileSync(path.join(dir, filename), fileBuffer);
  return buildPublicUrl(`audio/${filename}`);
}

// Compatibilidade: retorna URL de upload direto para o servidor
export async function getPresignedUploadUrl(
  productId: number,
  filename: string,
  mimeType: string
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const ext = path.extname(filename).toLowerCase() || ".jpg";
  const key = `${productId}/product_${productId}_${uid}${ext}`;

  return {
    uploadUrl: `${PUBLIC_BASE_URL}/api/upload/image`,
    publicUrl: buildPublicUrl(key),
    key,
  };
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  try {
    const url = new URL(imageUrl);
    const key = url.pathname.replace("/uploads/", "");
    const filepath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch {
    console.warn("[Storage] Não foi possível deletar imagem:", imageUrl);
  }
}
