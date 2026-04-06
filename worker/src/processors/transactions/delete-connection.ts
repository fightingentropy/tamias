import { trpc } from "@tamias/trpc";
import type { WorkerJob as Job } from "../../types/job";
import { deleteConnectionSchema, type DeleteConnectionPayload } from "../../schemas/transactions";
import { BaseProcessor } from "../base";

export class DeleteConnectionProcessor extends BaseProcessor<DeleteConnectionPayload> {
  protected getPayloadSchema() {
    return deleteConnectionSchema;
  }

  async process(job: Job<DeleteConnectionPayload>): Promise<{
    provider: DeleteConnectionPayload["provider"];
    referenceId: string | null;
  }> {
    const { referenceId, provider, accessToken } = job.data;

    await this.updateProgress(job, 20, undefined, "deleting-connection");

    await trpc.banking.deleteConnection.mutate({
      id: referenceId ?? "",
      provider,
      accessToken: accessToken ?? undefined,
    });

    await this.updateProgress(job, 100, undefined, "completed");

    return {
      provider,
      referenceId: referenceId ?? null,
    };
  }
}
