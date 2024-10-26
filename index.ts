import express from "express";
import fs from "fs";
import path from "path";
import { marked } from "marked";

const app = express();
const PORT = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Paths to the template and data JSON files
const templatePath = path.join(__dirname, "template.html");
const dataPath = path.join(__dirname, `data/${process.argv[2]}.json`);

let template: string;
let data: Record<string, any>;

// Load template and data files
function loadTemplate() {
  template = fs.readFileSync(templatePath, "utf-8");
  console.log("Template loaded");
}

function loadData() {
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    console.log("Data loaded from:", dataPath);
  } catch (err) {
    console.error("Error loading data file:", err);
  }
}

loadTemplate();
loadData();

fs.watchFile(templatePath, loadTemplate);
fs.watchFile(dataPath, loadData);

// Helper function to resolve nested object properties
function resolvePlaceholder(path: string, data: any): string {
  return path.split(".").reduce((obj, key) => obj?.[key], data) ?? "";
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  // Process markdown placeholders
  const markdownRegex = /{md%([\w.]+)%}/g;
  rendered = rendered.replace(markdownRegex, (_, key) => {
    const markdownContent = resolvePlaceholder(key.trim(), data);
    return markdownContent
      ? marked(markdownContent, { async: false, breaks: true })
      : "";
  });

  // Process loops
  const loopRegex = /{% for (\w+) in (\w+) %}([\s\S]*?){% endfor %}/g;
  rendered = rendered.replace(
    loopRegex,
    (_, itemVar, arrayVar, loopContent) => {
      const arrayData = data[arrayVar];
      if (Array.isArray(arrayData)) {
        return arrayData
          .map((item) =>
            renderTemplate(loopContent, { ...data, [itemVar]: item })
          )
          .join("");
      }
      return "";
    }
  );

  // Process standard placeholders
  const placeholderRegex = /{%([\w.]+)%}/g;
  rendered = rendered.replace(
    placeholderRegex,
    (_, key) => resolvePlaceholder(key.trim(), data) || ""
  );

  return rendered;
}

// Serve templated HTML
app.get("/", (_, res) => {
  const renderedHtml = renderTemplate(template, data);
  res.send(renderedHtml);
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
