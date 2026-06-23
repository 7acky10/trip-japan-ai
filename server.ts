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
  let defaultFirestore: Firestore;
  let firestoreBroken = false;
  let useDefaultFirestore = false;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("Found FIREBASE_SERVICE_ACCOUNT environment variable, parsing credentials...");
      try {
        const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firestore = new Firestore({
          projectId: credentials.project_id,
          credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
          },
        });
        defaultFirestore = new Firestore({
          projectId: credentials.project_id,
          databaseId: "(default)",
          credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
          },
        });
        console.log("Firestore client initialized with explicit Service Account credentials");
      } catch (err: any) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", err);
        firestoreBroken = true;
        firestore = new Firestore(); // Fallback dummy to satisfy assignment
        defaultFirestore = new Firestore();
      }
    } else {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        console.log("Initializing Firestore with config for project:", config.projectId);
        firestore = new Firestore({
          projectId: config.projectId,
          databaseId: config.firestoreDatabaseId || "(default)",
        });
        defaultFirestore = new Firestore({
          projectId: config.projectId,
          databaseId: "(default)",
        });
      } else {
        console.log("No local firebase-applet-config.json found, falling back to ambient Firestore credentials");
        firestore = new Firestore();
        defaultFirestore = new Firestore();
      }
    }
  } catch (e) {
    console.warn("Firestore client initialization failed, falling back to basic Firestore constructor:", e);
    firestore = new Firestore();
    defaultFirestore = new Firestore();
  }

  // --- ROBUST DUAL DATABASE ADAPTER ---
  // Local fallback JSON database file (for Render / local when not credentialed)
  const DB_FILE = path.join(process.cwd(), "db-shared.json");
  let localDb: Record<string, { trip: any; items: any[]; lastUpdated: number }> = {};
  
  // Try loading local fallback DB on startup
  try {
    if (fs.existsSync(DB_FILE)) {
      localDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      console.log("Loaded local fallback DB with", Object.keys(localDb).length, "trips");
    }
  } catch (e) {
    console.warn("Failed to load local fallback DB file, initializing empty:", e);
  }

  const saveLocalDb = () => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write local backup DB file:", e);
    }
  };

  async function getDbDoc(syncId: string): Promise<{ trip: any; items: any[] } | null> {
    const cleanId = syncId.toLowerCase();
    
    if (!firestoreBroken) {
      if (!useDefaultFirestore) {
        try {
          const docRef = firestore.collection("shares").doc(cleanId);
          const snapshot = await docRef.get();
          if (snapshot.exists) {
            const data = snapshot.data();
            return { trip: data?.trip, items: data?.items || [] };
          }
          return null;
        } catch (err: any) {
          const errMsg = err?.message || "";
          console.warn("Primary database read error:", errMsg);
          if (
            errMsg.includes("credentials") || 
            errMsg.includes("ADC") || 
            errMsg.includes("auth") || 
            errMsg.includes("key") || 
            errMsg.includes("PERMISSION_DENIED") || 
            errMsg.includes("NOT_FOUND") || 
            errMsg.includes("permission")
          ) {
            console.log("Primary database failed or lacks permission. Falling back to (default) database...");
            useDefaultFirestore = true;
          } else {
            console.error("Unhandled Firestore read error:", err);
            throw err;
          }
        }
      }

      if (useDefaultFirestore) {
        try {
          const docRef = defaultFirestore.collection("shares").doc(cleanId);
          const snapshot = await docRef.get();
          if (snapshot.exists) {
            const data = snapshot.data();
            return { trip: data?.trip, items: data?.items || [] };
          }
          return null;
        } catch (err: any) {
          const errMsg = err?.message || "";
          console.warn("Default database read failed too:", errMsg);
          console.warn("Falling back to local file db-shared.json.");
          firestoreBroken = true;
        }
      }
    }
    
    // Fallback path
    const found = localDb[cleanId];
    if (found) {
      return { trip: found.trip, items: found.items };
    }
    return null;
  }

  async function setDbDoc(syncId: string, data: { trip: any; items: any[]; lastUpdated: number }): Promise<void> {
    const cleanId = syncId.toLowerCase();
    
    if (!firestoreBroken) {
      if (!useDefaultFirestore) {
        try {
          await firestore.collection("shares").doc(cleanId).set(data);
          return;
        } catch (err: any) {
          const errMsg = err?.message || "";
          console.warn("Primary database write error:", errMsg);
          if (
            errMsg.includes("credentials") || 
            errMsg.includes("ADC") || 
            errMsg.includes("auth") || 
            errMsg.includes("key") || 
            errMsg.includes("PERMISSION_DENIED") || 
            errMsg.includes("NOT_FOUND") || 
            errMsg.includes("permission")
          ) {
            console.log("Primary database failed or lacks permission. Trying default database on write...");
            useDefaultFirestore = true;
          } else {
            console.error("Unhandled Firestore write error:", err);
            throw err;
          }
        }
      }

      if (useDefaultFirestore) {
        try {
          await defaultFirestore.collection("shares").doc(cleanId).set(data);
          return;
        } catch (err: any) {
          const errMsg = err?.message || "";
          console.warn("Default database write failed too:", errMsg);
          console.warn("Falling back to local file db-shared.json.");
          firestoreBroken = true;
        }
      }
    }
    
    // Fallback path
    localDb[cleanId] = data;
    saveLocalDb();
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

      await setDbDoc(syncId, docData);
      res.json({ syncId, message: "Share established successfully!" });
    } catch (err: any) {
      console.error("Set DB Doc failed:", err);
      res.status(500).json({ error: "建立雲端分享發生錯誤，請稍後再試！" });
    }
  });

  // API Route - Get Shared Trip
  app.get("/api/share/:syncId", async (req: any, res: any) => {
    const { syncId } = req.params;
    const cleanId = syncId.toLowerCase();

    try {
      const data = await getDbDoc(cleanId);
      if (!data) {
        return res.status(404).json({ error: "Sorry, this trip sync code does not exist!" });
      }

      res.json({ trip: data.trip, items: data.items });
    } catch (err: any) {
      console.error("Get DB Doc failed:", err);
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

      await setDbDoc(cleanId, docData);
      res.json({ success: true, message: "Synced successfully!" });
    } catch (err: any) {
      console.error("Update DB Doc failed:", err);
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
