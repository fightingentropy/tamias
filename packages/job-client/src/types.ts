/**
 * Job status enum matching the API schema
 */
export type RunStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "canceled"
  | "unknown";

/**
 * Job status response matching the API schema
 */
export interface RunStatusResponse {
  status: RunStatus;
  progress?: number;
  progressStep?: string;
  result?: unknown;
  error?: string;
}

/**
 * Async run creation response
 */
export interface AsyncRunResponse {
  runId: string;
}
