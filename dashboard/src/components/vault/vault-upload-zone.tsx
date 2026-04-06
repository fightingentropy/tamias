"use client";

import { cn } from "@tamias/ui/cn";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { useUpload } from "@/hooks/use-upload";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { buildUploadedFilePath } from "@/utils/upload";

type Props = {
  children: ReactNode;
  onUpload?: (
    results: {
      file_path: string[];
      mimetype: string;
      size: number;
    }[],
  ) => void;
};

export function VaultUploadZone({ onUpload, children }: Props) {
  const trpc = useTRPC();
  const { data: user } = useUserQuery();
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [toastId, setToastId] = useState<string | null>(null);
  const uploadProgress = useRef<number[]>([]);
  const { toast, dismiss, update } = useToast();
  const { uploadFile } = useUpload();

  const processDocumentMutation = useMutation(trpc.documents.processDocument.mutationOptions());

  useEffect(() => {
    if (!toastId && showProgress) {
      const { id } = toast({
        title: `Uploading ${uploadProgress.current.length} files`,
        progress,
        variant: "progress",
        description: "Please do not close browser until completed",
        duration: Number.POSITIVE_INFINITY,
      });

      setToastId(id);
    } else if (toastId) {
      update(toastId, {
        id: toastId,
        title: `Uploading ${uploadProgress.current.length} files`,
        progress,
        variant: "progress",
      });
    }
  }, [showProgress, progress, toastId]);

  const onDrop = async (files: File[]) => {
    // NOTE: If onDropRejected
    if (!files.length) {
      return;
    }

    if (!user?.teamId) {
      toast({
        duration: 2500,
        variant: "error",
        title: "Unable to upload. Please try again.",
      });
      return;
    }

    // Set default progress
    uploadProgress.current = files.map(() => 0);

    setShowProgress(true);

    // Add uploaded (team_id)
    const path = [user.teamId];

    try {
      const results = await Promise.all(
        files.map(async (file: File, idx: number) =>
          uploadFile({
            bucket: "vault",
            path: buildUploadedFilePath(path, file.name),
            file,
            onProgress: (bytesUploaded: number, bytesTotal: number) => {
              uploadProgress.current[idx] = (bytesUploaded / bytesTotal) * 100;

              const _progress = uploadProgress.current.reduce((acc, currentValue) => {
                return acc + currentValue;
              }, 0);

              setProgress(Math.round(_progress / files.length));
            },
          }),
        ),
      );

      // Trigger the upload jobs
      processDocumentMutation.mutate(
        results.map((result) => ({
          filePath: result.path,
          mimetype: result.file.type,
          size: result.file.size,
        })),
      );

      // Reset once done
      uploadProgress.current = [];

      setProgress(0);
      toast({
        title: "Upload successful.",
        variant: "success",
        duration: 2000,
      });

      setShowProgress(false);
      setToastId(null);
      if (toastId) {
        dismiss(toastId);
      }

      // Type the results properly for onUpload callback
      const typedResults = results.map((result) => ({
        file_path: result.path,
        mimetype: result.file.type,
        size: result.file.size,
      }));

      onUpload?.(typedResults);
    } catch {
      toast({
        duration: 2500,
        variant: "error",
        title: "Something went wrong please try again.",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: ([reject]: FileRejection[]) => {
      if (reject?.errors.find(({ code }) => code === "file-too-large")) {
        toast({
          duration: 2500,
          variant: "error",
          title: "File size to large.",
        });
      }

      if (reject?.errors.find(({ code }) => code === "file-invalid-type")) {
        toast({
          duration: 2500,
          variant: "error",
          title: "File type not supported.",
        });
      }
    },
    maxSize: 5000000, // 5MB
    maxFiles: 25,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.oasis.opendocument.text": [".odt"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.oasis.opendocument.spreadsheet": [".ods"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.oasis.opendocument.presentation": [".odp"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md"],
      "application/rtf": [".rtf"],
      "application/zip": [".zip"],
    },
  });

  return (
    <div className="relative h-full" {...getRootProps({ onClick: (evt) => evt.stopPropagation() })}>
      <div className="absolute top-0 right-0 left-0 z-[51] w-full pointer-events-none h-[calc(100vh-150px)]">
        <div
          className={cn(
            "bg-background h-full w-full flex items-center justify-center text-center",
            isDragActive ? "visible" : "invisible",
          )}
        >
          <input {...getInputProps()} id="upload-files" />

          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-xs">
              Drop your documents and files here. <br />
              Maximum of 25 files at a time.
            </p>

            <span className="text-xs text-[#878787]">Max file size 5MB</span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
