#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// Reuse the exact vector geometry already used by the Tamias web product.
const iosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(
  path.join(iosRoot, "../packages/ui/src/components/icons.tsx"),
  "utf8",
);
const logoSection = source.split("LogoSmall:")[1]?.split("Logo:")[0];
const logoPath = logoSection?.match(/d="([^"]+)"/)?.[1];
if (!logoPath) throw new Error("Cannot locate the Tamias LogoSmall vector path.");

const assetRoot = path.join(iosRoot, "Tamias/Assets.xcassets");
const iconRoot = path.join(assetRoot, "AppIcon.appiconset");
const markRoot = path.join(assetRoot, "TamiasMark.imageset");
await mkdir(iconRoot, { recursive: true });
await mkdir(markRoot, { recursive: true });

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#131c18"/><g transform="translate(220 220) scale(20.857142857)"><path fill="#f7f4e1" d="${logoPath}"/></g></svg>`;
await sharp(Buffer.from(icon))
  .flatten({ background: "#131c18" })
  .png()
  .toFile(path.join(iconRoot, "AppIcon.png"));
await writeFile(
  path.join(iconRoot, "Contents.json"),
  JSON.stringify(
    {
      images: [{ filename: "AppIcon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  ) + "\n",
);

const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path fill="#000000" d="${logoPath}"/></svg>\n`;
await writeFile(path.join(markRoot, "TamiasMark.svg"), mark);
await writeFile(
  path.join(markRoot, "Contents.json"),
  JSON.stringify(
    {
      images: [{ filename: "TamiasMark.svg", idiom: "universal" }],
      info: { author: "xcode", version: 1 },
      properties: {
        "preserves-vector-representation": true,
        "template-rendering-intent": "template",
      },
    },
    null,
    2,
  ) + "\n",
);
console.log("Generated the Tamias app icon and template vector mark.");
