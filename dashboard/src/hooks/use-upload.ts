"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { type UploadResult, uploadFileToStorage } from "@/utils/upload";
import { useTRPC } from "@/trpc/client";

interface UploadParams {
  file: File;
  path: string[];
  bucket: string;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
}

export function useUpload() {
  const trpc = useTRPC();
  const [activeUploads, setActiveUploads] = useState(0);
  const generateUploadUrl = useMutation(
    trpc.uploads.generateUrl.mutationOptions(),
  );
  const registerUpload = useMutation(
    trpc.uploads.register.mutationOptions(),
  );

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
          generateUploadUrl: () => generateUploadUrl.mutateAsync(),
          registerUpload: (args) => registerUpload.mutateAsync(args),
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
