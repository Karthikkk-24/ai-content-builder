import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@/app/api/uploadthing/core";

const { uploadFiles } = genUploader<UploadRouter>();

export { uploadFiles };
