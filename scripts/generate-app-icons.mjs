import sharp from "sharp";

for (const size of [192, 512]) {
  await sharp("public/app-icon.svg").resize(size, size).png().toFile(`public/app-icon-${size}.png`);
}
await sharp("public/app-icon.svg").resize(180, 180).png().toFile("public/apple-touch-icon.png");
