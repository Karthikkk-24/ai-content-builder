import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteFiles = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = (...args: unknown[]) => deleteFiles(...args);
  },
}));

describe("persistUploadMetadata", () => {
  beforeEach(() => {
    deleteFiles.mockReset();
    deleteFiles.mockResolvedValue({ success: true, deletedCount: 1 });
  });

  it("does not delete when persist succeeds", async () => {
    const { persistUploadMetadata } = await import("@/lib/uploadthing-persist");
    const persist = vi.fn().mockResolvedValue(undefined);
    await persistUploadMetadata("file-key", persist);
    expect(persist).toHaveBeenCalledOnce();
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("rolls back the blob and throws a generic error when persist fails", async () => {
    const { persistUploadMetadata, UPLOAD_PERSIST_FAILED_MESSAGE } =
      await import("@/lib/uploadthing-persist");
    await expect(
      persistUploadMetadata("file-key", async () => {
        throw new Error("duplicate key value violates unique constraint");
      })
    ).rejects.toThrow(UPLOAD_PERSIST_FAILED_MESSAGE);

    expect(deleteFiles).toHaveBeenCalledWith("file-key");
  });
});
