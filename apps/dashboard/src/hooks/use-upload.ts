"use client";

import { useMutation as useConvexMutation } from "convex/react";
import { useState } from "react";
import { api } from "@tamias/convex-model/api";
import { type UploadResult, uploadFileToStorage } from "@/utils/upload";

interface UploadParams {
  file: File;
  path: string[];
  bucket: string;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
}

export function useUpload() {
  const [activeUploads, setActiveUploads] = useState(0);
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);
  const registerUpload = useConvexMutation(api.files.registerUpload);

  const uploadFile = async ({
    file,
    path,
    bucket,
    onProgress,
  }: UploadParams): Promise<UploadResult> => {
    setActiveUploads((count) => count + 1);

    try {
      const result = await uploadFileToStorage(
        {
          generateUploadUrl,
          registerUpload,
        },
        {
          bucket,
          file,
          onProgress,
          path,
        },
      );

      return result;
    } finally {
      setActiveUploads((count) => Math.max(0, count - 1));
    }
  };

  return {
    uploadFile,
    isLoading: activeUploads > 0,
  };
}
