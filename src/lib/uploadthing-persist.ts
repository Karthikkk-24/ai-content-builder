import { deleteUploadthingFileKeys } from "@/lib/uploadthing-files";

export const UPLOAD_PERSIST_FAILED_MESSAGE = "Failed to save uploaded file";

/**
 * Run DB persist after Uploadthing already stored the blob.
 * On failure, delete the blob (best-effort) and rethrow a generic error so
 * the client is not told the upload succeeded.
 */
export async function persistUploadMetadata<T>(
  fileKey: string,
  persist: () => Promise<T>
): Promise<T> {
  try {
    return await persist();
  } catch (error) {
    console.error("Failed to persist Uploadthing metadata:", error);
    await deleteUploadthingFileKeys([fileKey]);
    throw new Error(UPLOAD_PERSIST_FAILED_MESSAGE);
  }
}
