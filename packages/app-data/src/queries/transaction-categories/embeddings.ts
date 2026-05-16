import { CategoryEmbeddings } from "@tamias/categories";
import type { Database } from "../../client";
import { logger } from "@tamias/logger";
import { getCategoryEmbedding, upsertCategoryEmbedding } from "../transaction-category-embeddings";

export async function generateCategoryEmbedding(
  db: Database,
  params: {
    name: string;
    system?: boolean;
  },
) {
  const { name, system = false } = params;

  try {
    const existingEmbedding = await getCategoryEmbedding(db, { name });

    if (existingEmbedding) {
      logger.info(`Embedding already exists for category: "${name}"`);
      return;
    }

    const embedService = new CategoryEmbeddings();
    const { embedding, model } = await embedService.embed(name);

    await upsertCategoryEmbedding(db, {
      name,
      embedding,
      system,
      model,
    });

    logger.info(`Generated embedding for category: "${name}"`);
  } catch (error) {
    logger.error(`Failed to generate embedding for "${name}"`, { error });
  }
}
