export type WorkerJobProgress =
  | number
  | {
      progress?: number;
      message?: string;
      step?: string;
    };

export type WorkerJobOptions = {
  attempts?: number;
  removeOnComplete?: boolean | object;
};

export type WorkerJob<TData = unknown> = {
  id?: string;
  runId?: string;
  name: string;
  data: TData;
  attemptsMade: number;
  opts: WorkerJobOptions;
  updateProgress?: (progress: WorkerJobProgress) => Promise<void>;
};
