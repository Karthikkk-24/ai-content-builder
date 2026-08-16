export const UPLOAD_PERSIST_FAILED_MESSAGE = "Failed to save uploaded file";

/**
 * Run DB persist after Uploadthing already stored the blob.
 * On failure, delete the blob (best-effort) and rethrow a generic error so
 * the client is not told the upload succeeded.
 */
export async function persistUploadMetadata(
  fileKey: string,
  persist: () => Promise<void>
): Promise<void> {
  try {
    await persist();
  } catch (error) {
    console.error("Failed to persist Uploadthing metadata:", error);
    try {
      const { UTApi } = await import("uploadthing/server");
      const result = await new UTApi().deleteFiles(fileKey);
      if (!result.success) {
        console.error("Uploadthing rollback deleteFiles did not succeed", {
          fileKey,
          deletedCount: result.deletedCount,
        });
      }
    } catch (cleanupError) {
      console.error(
        "Failed to delete Uploadthing blob after persist error:",
        cleanupError
      );
    }
    throw new Error(UPLOAD_PERSIST_FAILED_MESSAGE);
  }
}
