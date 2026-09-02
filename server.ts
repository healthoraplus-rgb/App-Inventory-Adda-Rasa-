import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON & text bodies
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(express.text({ limit: "50mb", type: "text/*" }));

  // CORS headers for all API requests
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "ADDA RASA Inventory Backend Proxy" });
  });

  // Google Sheets & Apps Script Proxy Endpoint
  // Solves any browser CORS / iframe restrictions when communicating with Google Apps Script
  app.all("/api/sheets-proxy", async (req, res) => {
    try {
      const targetUrl =
        (req.query.url as string) ||
        (req.body && typeof req.body === "object" ? req.body.url : undefined);

      if (!targetUrl || !targetUrl.startsWith("https://script.google.com/")) {
        return res.status(400).json({
          status: "error",
          message: "URL Google Apps Script tidak valid. Format harus diawali https://script.google.com/...",
        });
      }

      if (req.method === "GET") {
        const fetchRes = await fetch(targetUrl, {
          method: "GET",
          redirect: "follow",
        });

        const text = await fetchRes.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.send(text);
        }
      } else if (req.method === "POST") {
        const payload = req.body && req.body.payload !== undefined ? req.body.payload : req.body;
        const bodyText = typeof payload === "string" ? payload : JSON.stringify(payload);

        const fetchRes = await fetch(targetUrl, {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: bodyText,
        });

        const text = await fetchRes.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.send(text);
        }
      } else {
        return res.status(405).json({ status: "error", message: "Method not allowed" });
      }
    } catch (err: any) {
      console.error("Sheets Proxy Error:", err);
      return res.status(500).json({
        status: "error",
        message: `Proxy Error: ${err.message || String(err)}`,
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
