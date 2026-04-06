import {
  getTransactionCategoryEmbeddingsByNamesFromConvex,
  upsertTransactionCategoryEmbeddingsInConvex,
} from "@tamias/app-data-convex";
import { CategoryEmbeddings } from "@tamias/categories";
import type { Database } from "../../client";
import { logger } from "@tamias/logger";

export async function generateCategoryEmbedding(
  _db: Database,
  params: {
    name: string;
    system?: boolean;
  },
) {
  const { name, system = false } = params;

  try {
    const [existingEmbedding] =
      await getTransactionCategoryEmbeddingsByNamesFromConvex({
        names: [name],
      });

    if (existingEmbedding) {
      logger.info(`Embedding already exists for category: "${name}"`);
      return;
    }

    const embedService = new CategoryEmbeddings();
    const { embedding, model } = await embedService.embed(name);

    await upsertTransactionCategoryEmbeddingsInConvex({
      embeddings: [
        {
          name,
          embedding,
          system,
          model,
        },
      ],
    });

    logger.info(`Generated embedding for category: "${name}"`);
  } catch (error) {
    logger.error(`Failed to generate embedding for "${name}"`, { error });
  }
}
