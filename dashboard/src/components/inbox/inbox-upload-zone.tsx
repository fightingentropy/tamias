"use client";

import { cn } from "@tamias/ui/cn";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUpload } from "@/hooks/use-upload";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { buildUploadedFilePath } from "@/utils/upload";

type ProcessAttachmentInput = {
  filePath: string[];
  mimetype: string;
  size: number;
};

type Props = {
  children: ReactNode;
  onUploadComplete?: (inboxId?: string) => void;
};

export function UploadZone({ children, onUploadComplete }: Props) {
  const trpc = useTRPC();
  const { data: user } = useUserQuery();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [toastId, setToastId] = useState<string | undefined>(undefined);
  const uploadProgress = useRef<number[]>([]);
  const { toast, dismiss, update } = useToast();
  const { uploadFile } = useUpload();
  const processAttachmentsMutation = useMutation(
    trpc.inbox.processAttachments.mutationOptions(),
  );
  const createInboxItemMutation = useMutation(
    trpc.inbox.create.mutationOptions(),
  );

  useEffect(() => {
    if (!toastId && showProgress) {
      const { id } = toast({
        title: `Uploading ${uploadProgress.current.length} files`,
        progress,
        variant: "progress",
        description: "Please do not close browser until completed",
        duration: Number.POSITIVE_INFINITY,
      });

      if (id) {
        setToastId(id);
      }
    } else if (toastId) {
      update(toastId, {
        id: toastId,
        progress,
        title: `Uploading ${uploadProgress.current.length} files`,
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

    const path = [user.teamId, "inbox"];

    try {
      // First, create inbox items immediately for instant feedback
      const inboxItems = await Promise.all(
        files.map(async (file: File) => {
          const filePath = buildUploadedFilePath(path, file.name);
          const processedFilename = filePath.at(-1) ?? file.name;
          return createInboxItemMutation.mutateAsync({
            filename: processedFilename,
            mimetype: file.type,
            size: file.size,
            filePath,
          });
        }),
      );

      // Invalidate inbox queries to show new items immediately
      queryClient.invalidateQueries({
        queryKey: trpc.inbox.get.queryKey(),
      });

      queryClient.invalidateQueries({
        queryKey: trpc.inbox.get.infiniteQueryKey(),
      });

      const results = await Promise.all(
        files.map(async (file: File, idx: number) =>
          uploadFile({
            bucket: "vault",
            path: buildUploadedFilePath(path, file.name),
            file,
            onProgress: (bytesUploaded, bytesTotal) => {
              uploadProgress.current[idx] = (bytesUploaded / bytesTotal) * 100;

              const _progress = uploadProgress.current.reduce(
                (acc, currentValue) => {
                  return acc + currentValue;
                },
                0,
              );

              setProgress(Math.round(_progress / files.length));
            },
          }),
        ),
      );

      // Trigger the upload jobs
      processAttachmentsMutation.mutate(
        results.map(
          (result): ProcessAttachmentInput => ({
            filePath: result.path,
            mimetype: result.file.type,
            size: result.file.size,
          }),
        ),
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
      setToastId(undefined);
      dismiss(toastId);
      onUploadComplete?.(inboxItems[0]?.id);
    } catch (_error) {
      // Refresh inbox to show current state after error
      queryClient.invalidateQueries({
        queryKey: trpc.inbox.get.queryKey(),
      });

      setShowProgress(false);
      setToastId(undefined);
      dismiss(toastId);

      toast({
        duration: 2500,
        variant: "error",
        title: "Something went wrong please try again.",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: ([reject]) => {
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
    },
  });

  return (
    <div
      {...getRootProps({ onClick: (evt) => evt.stopPropagation() })}
      className="relative h-full"
    >
      <div className="absolute top-0 bottom-0 right-0 left-0 z-[51] pointer-events-none">
        <div
          className={cn(
            "bg-background h-full flex items-center justify-center text-center invisible",
            isDragActive && "visible",
          )}
        >
          <input {...getInputProps()} id="upload-files" />
          <p className="text-xs">
            Drop your receipts here. <br />
            Maximum of 25 files at a time.
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
