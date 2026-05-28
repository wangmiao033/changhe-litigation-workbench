import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "app.js", "styles.css"];

rmSync("public", { recursive: true, force: true });
mkdirSync("public", { recursive: true });

for (const file of files) {
  cpSync(file, `public/${file}`);
}

console.log(`Prepared public/: ${files.join(", ")}`);
