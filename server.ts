import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Let Express parse JSON bodies up to 10MB safely
  app.use(express.json({ limit: "10mb" }));

  // Shared trips DB file persistence fallback
  const DB_FILE = path.join(process.cwd(), "db-shared.json");
  let sharedDb: Record<string, { trip: any; items: any[]; lastUpdated: number }> = {};

  try {
    if (fs.existsSync(DB_FILE)) {
      sharedDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Local database load warning, fallback to memory DB", e);
  }

  const saveDb = () => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(sharedDb, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write persistence database file:", e);
    }
  };

  // API Route - Create Share Trip
  app.post("/api/share", (req: any, res: any) => {
    const { trip, items } = req.body;
    if (!trip || !items) {
      return res.status(400).json({ error: "Missing trip or items data" });
    }

    // Generate a clean 6-character sharing code
    const syncId = Math.random().toString(36).substring(2, 8).toLowerCase();
    sharedDb[syncId] = {
      trip: { ...trip, syncId },
      items,
      lastUpdated: Date.now()
    };

    saveDb();
    res.json({ syncId, message: "Share established successfully!" });
  });

  // API Route - Get Shared Trip
  app.get("/api/share/:syncId", (req: any, res: any) => {
    const { syncId } = req.params;
    const cleanId = syncId.toLowerCase();
    const found = sharedDb[cleanId];

    if (!found) {
      return res.status(404).json({ error: "Sorry, this trip sync code does not exist!" });
    }

    res.json({ trip: found.trip, items: found.items });
  });

  // API Route - Sync/Update Shared Trip
  app.put("/api/share/:syncId", (req: any, res: any) => {
    const { syncId } = req.params;
    const cleanId = syncId.toLowerCase();
    const { trip, items } = req.body;

    if (!trip || !items) {
      return res.status(400).json({ error: "Missing trip or items data for sync" });
    }

    sharedDb[cleanId] = {
      trip: { ...trip, syncId: cleanId },
      items,
      lastUpdated: Date.now()
    };

    saveDb();
    res.json({ success: true, message: "Synced successfully!" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
