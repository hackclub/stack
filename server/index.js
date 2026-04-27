import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "stack-api" });
});

if (isProd) {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(
    `Server http://localhost:${PORT} (${isProd ? "serving React build" : "API only — use Vite on :5173 for UI"})`
  );
});
