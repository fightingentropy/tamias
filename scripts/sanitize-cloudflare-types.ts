import { readFile, writeFile } from "node:fs/promises";

const generatedTypesPath = new URL("../types/cloudflare-env.d.ts", import.meta.url);
const providerCatalogPattern = /^type AIGatewayProviders = .*;$/m;
const generatedTypes = await readFile(generatedTypesPath, "utf8");

if (!providerCatalogPattern.test(generatedTypes)) {
  throw new Error("Expected AI Gateway provider catalog was not found in generated types");
}

const sanitizedTypes = generatedTypes.replace(
  providerCatalogPattern,
  "type AIGatewayProviders = string;",
);

await writeFile(generatedTypesPath, sanitizedTypes);
console.log("Sanitized generated Cloudflare provider catalog");
