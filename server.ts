import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Firestore } from "@google-cloud/firestore";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Let Express parse JSON bodies up to 10MB safely
  app.use(express.json({ limit: "10mb" }));

  // Initialize Cloud Firestore client
  let firestore: Firestore;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      console.log("Initializing Firestore with config for project:", config.projectId);
      firestore = new Firestore({
        projectId: config.projectId,
        databaseId: config.firestoreDatabaseId || "(default)",
      });
    } else {
      console.log("No local firebase-applet-config.json found, falling back to ambient Firestore credentials");
      firestore = new Firestore();
    }
  } catch (e) {
    console.warn("Firestore client initialization failed, falling back to basic Firestore constructor:", e);
    firestore = new Firestore();
  }

  // API Route - Create Share Trip
  app.post("/api/share", async (req: any, res: any) => {
    const { trip, items } = req.body;
    if (!trip || !items) {
      return res.status(400).json({ error: "Missing trip or items data" });
    }

    try {
      // Generate a clean 6-character sharing code
      const syncId = Math.random().toString(36).substring(2, 8).toLowerCase();
      
      const docData = {
        trip: { ...trip, syncId },
        items,
        lastUpdated: Date.now()
      };

      await firestore.collection("shares").doc(syncId).set(docData);
      res.json({ syncId, message: "Share established successfully!" });
    } catch (err: any) {
      console.error("Firestore Write Error on /api/share:", err);
      res.status(500).json({ error: "建立雲端分享發生錯誤，請稍後再試！" });
    }
  });

  // API Route - Get Shared Trip
  app.get("/api/share/:syncId", async (req: any, res: any) => {
    const { syncId } = req.params;
    const cleanId = syncId.toLowerCase();

    try {
      const docRef = firestore.collection("shares").doc(cleanId);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({ error: "Sorry, this trip sync code does not exist!" });
      }

      const data = snapshot.data();
      res.json({ trip: data?.trip, items: data?.items || [] });
    } catch (err: any) {
      console.error("Firestore Read Error on /api/share/:syncId:", err);
      res.status(500).json({ error: "讀取雲端行程發生錯誤，請稍後再試！" });
    }
  });

  // API Route - Sync/Update Shared Trip
  app.put("/api/share/:syncId", async (req: any, res: any) => {
    const { syncId } = req.params;
    const cleanId = syncId.toLowerCase();
    const { trip, items } = req.body;

    if (!trip || !items) {
      return res.status(400).json({ error: "Missing trip or items data for sync" });
    }

    try {
      const docData = {
        trip: { ...trip, syncId: cleanId },
        items,
        lastUpdated: Date.now()
      };

      await firestore.collection("shares").doc(cleanId).set(docData);
      res.json({ success: true, message: "Synced successfully!" });
    } catch (err: any) {
      console.error("Firestore Update Error on /api/share/:syncId:", err);
      res.status(500).json({ error: "同步雲端行程發生錯誤，請稍後再試！" });
    }
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
