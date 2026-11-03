// src/scripts/generate-tree.js
const fs = require("fs");
const path = require("path");

// Project root = two levels up from src/scripts/
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "PROJECT-STRUCTURE.md");

// Folders and files to exclude
const EXCLUDE = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".env",
  ".env.local",
  ".DS_Store",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "generate-tree.js",
  "PROJECT-STRUCTURE.md",
]);

const lines = ["# Project Structure", "", "```"];

function walk(dir, prefix = "") {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const filtered = entries.filter((entry) => !EXCLUDE.has(entry.name));

  filtered.forEach((entry, index) => {
    const isLast = index === filtered.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    lines.push(
      `${prefix}${connector}${entry.name}${entry.isDirectory() ? "/" : ""}`
    );

    if (entry.isDirectory()) {
      walk(path.join(dir, entry.name), prefix + childPrefix);
    }
  });
}

walk(ROOT);

lines.push("```", "");

fs.writeFileSync(OUTPUT, lines.join("\n"), "utf8");

console.log(`✅ Generated ${OUTPUT}`);