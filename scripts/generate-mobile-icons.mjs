import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Reuse the existing vector brand mark; Android masks the central 72/108 area.
// The 44dp mark stays comfortably inside the 66dp adaptive-icon safe circle.
const source = await readFile(
  new URL("../public/app-icon.svg", import.meta.url),
  "utf8",
);
const path = source.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];
if (!path) throw new Error("Brand vector path missing");
const background = `<defs><linearGradient id="blue" x2="1" y2="1"><stop stop-color="#2447e6"/><stop offset=".6" stop-color="#0129ac"/><stop offset="1" stop-color="#011e80"/></linearGradient></defs><rect width="108" height="108" fill="url(#blue)"/>`;
const mark = (height, color) => {
  const width = (height * 330) / 383;
  return `<svg x="${(108 - width) / 2}" y="${(108 - height) / 2}" width="${width}" height="${height}" viewBox="0 0 330 383"><path fill="${color}" fill-rule="evenodd" d="${path}"/></svg>`;
};
const svg = (content) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 108 108">${content}</svg>`,
  );
const assets = new URL("../apps/mobile/assets/", import.meta.url);
for (const [name, content] of [
  ["icon.png", background + mark(62, "#f9af03")],
  ["android-icon-foreground.png", mark(44, "#f9af03")],
  ["android-icon-background.png", background],
  ["android-icon-monochrome.png", mark(44, "#ffffff")],
]) {
  await sharp(svg(content))
    .png()
    .toFile(fileURLToPath(new URL(name, assets)));
}
console.log(
  "Generated mobile icons from the existing ReliantOutreach vector mark.",
);
