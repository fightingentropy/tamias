#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// Adds one clearly fictional receipt to an explicitly selected simulator.
// Never erases a library, boots a device, or accesses a physical iPhone.
const iosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(iosRoot, "TamiasUITests/Fixtures");
const fixture = path.join(fixtureDirectory, "SAMPLE-receipt.png");
await mkdir(fixtureDirectory, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260" viewBox="0 0 900 1260">
  <rect width="900" height="1260" fill="#fbfaf5"/>
  <rect x="45" y="45" width="810" height="1170" rx="16" fill="white" stroke="#d9ddd5" stroke-width="3"/>
  <rect x="85" y="85" width="730" height="135" rx="8" fill="#fff0cb"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#17251d" text-anchor="middle">
    <text x="450" y="175" font-size="80" font-weight="700">SAMPLE</text>
    <text x="450" y="300" font-size="48" font-weight="700">MOONBEAM COFFEE</text>
    <text x="450" y="357" font-size="31">Fictional shop - UI test fixture</text>
    <text x="450" y="432" font-size="32">8 September 2026</text>
  </g>
  <path d="M100 475H800 M100 680H800 M100 860H800" stroke="#aeb8ad" stroke-width="3" stroke-dasharray="10 10"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#17251d" font-size="39">
    <text x="110" y="550">Coffee and pastries</text>
    <text x="790" y="550" text-anchor="end">14.00</text>
    <text x="110" y="625">Tea</text>
    <text x="790" y="625" text-anchor="end">4.50</text>
    <text x="110" y="785" font-size="52" font-weight="700">TOTAL</text>
    <text x="790" y="785" text-anchor="end" font-size="52" font-weight="700">GBP 18.50</text>
  </g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#516053" text-anchor="middle" font-weight="700">
    <text x="450" y="963" font-size="40">FOR UI TESTING ONLY</text>
    <text x="450" y="1031" font-size="37">NOT A REAL TRANSACTION</text>
    <text x="450" y="1130" font-size="29" font-weight="400">No payment was made. No customer data.</text>
  </g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(fixture);

const simulatorID = process.argv[2];
if (simulatorID === "--generate-only") {
  console.log(`Generated ${fixture}`);
  process.exit(0);
}
if (!simulatorID)
  throw new Error("Pass a booted simulator UDID, or --generate-only. No device was modified.");
const developerDirectory =
  process.env.DEVELOPER_DIR ||
  [
    "/Applications/Xcode.app/Contents/Developer",
    "/Applications/Xcode-beta.app/Contents/Developer",
  ].find(existsSync);
if (!developerDirectory) throw new Error("A full Xcode installation is required.");
const environment = { ...process.env, DEVELOPER_DIR: developerDirectory };
const inventory = JSON.parse(
  execFileSync("xcrun", ["simctl", "list", "devices", "--json"], {
    env: environment,
    encoding: "utf8",
  }),
);
const simulator = Object.values(inventory.devices)
  .flat()
  .find((device) => device.udid === simulatorID);
if (!simulator || simulator.state !== "Booted")
  throw new Error("Pass the exact UDID of a booted simulator. No device was modified.");
execFileSync("xcrun", ["simctl", "addmedia", simulatorID, fixture], {
  env: environment,
  stdio: "inherit",
});
console.log(
  `Added one SAMPLE receipt to simulator ${simulator.name} (${simulatorID}). Existing photos were kept.`,
);
