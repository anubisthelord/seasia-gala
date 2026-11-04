import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const STORAGE_DIRECTORY = path.join(
  process.cwd(),
  "storage",
  "private",
  "partner-documents"
);

/** Image uploads are rasterized to WebP before private storage. */

export async function savePartnerDocument(file: File) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Document must be between 1 byte and 5 MB.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  let buffer: Buffer;
  try {
    buffer = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25_000_000,
    })
      .rotate()
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error("The uploaded file is not a supported image.");
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("The processed image is too large.");
  }

  await mkdir(STORAGE_DIRECTORY, { recursive: true });

  const filename = `${randomUUID()}.webp`;
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
