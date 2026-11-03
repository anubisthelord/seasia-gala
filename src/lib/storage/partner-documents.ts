import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const STORAGE_DIRECTORY = path.join(
  process.cwd(),
  "storage",
  "private",
  "partner-documents"
);

/**
 * Allowed upload types.
 *
 * NOTE: `documentType` on PartnerDocument is always "IMAGE" now,
 * so this map only describes MIME → extension + signature validator.
 */
const ALLOWED_TYPES = {
  "image/jpeg": {
    extension: ".jpg",
    validate: (buffer: Buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  "image/png": {
    extension: ".png",
    validate: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      ),
  },
  "image/webp": {
    extension: ".webp",
    // RIFF....WEBP  — bytes 0..3 = "RIFF", bytes 8..11 = "WEBP"
    validate: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
} as const;

export async function savePartnerDocument(file: File) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Document must be between 1 byte and 5 MB.");
  }

  const fileType =
    ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];

  if (!fileType) {
    throw new Error("Only JPG, PNG and WEBP images are allowed.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!fileType.validate(buffer)) {
    throw new Error("The uploaded file does not match its file type.");
  }

  await mkdir(STORAGE_DIRECTORY, { recursive: true });

  const filename = `${randomUUID()}${fileType.extension}`;
  const absolutePath = path.join(STORAGE_DIRECTORY, filename);

  await writeFile(absolutePath, buffer, {
    flag: "wx",
    mode: 0o600,
  });

  return {
    storageKey: `partner-documents/${filename}`,
    absolutePath,
  };
}

export async function deletePartnerDocument(
  absolutePath: string
) {
  try {
    await unlink(absolutePath);
  } catch (error) {
    console.error("Unable to remove partner document:", error);
  }
}