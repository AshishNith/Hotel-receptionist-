import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

import { PORT, connectDatabase } from "./config.js";
console.log(`[Config] Resolved PORT is: ${PORT}, process.env.PORT is: ${process.env.PORT}`);
import { PersonaModel } from "./models/Persona.js";
import { DEFAULT_PERSONAS } from "./defaults/personas.js";

// Route modules
import personaRoutes from "./routes/personas.js";
import knowledgeBaseRoutes from "./routes/knowledgeBases.js";
import authRoutes from "./routes/auth.js";
import telephonyRoutes from "./routes/telephony.js";
import analyticsRoutes from "./routes/analytics.js";
import healthRoutes from "./routes/health.js";
import toolsRoutes from "./routes/tools.js";

// WebSocket handlers
import { handleBrowserWebSocket } from "./handlers/browserWs.js";
import { handleTelephonyWebSocket } from "./handlers/telephonyWs.js";

// ─── Express Setup ──────────────────────────────────────────────
const app = express();
const httpServer = createHttpServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Mount Route Modules ────────────────────────────────────────
app.use("/api/personas", personaRoutes);
app.use("/api/knowledge-bases", knowledgeBaseRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", telephonyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/tools", toolsRoutes);

// ─── WebSocket Servers ──────────────────────────────────────────
const wssBrowser = new WebSocketServer({ noServer: true });
const wssTelephony = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/live") {
    wssBrowser.handleUpgrade(request, socket, head, (ws) => {
      wssBrowser.emit("connection", ws, request);
    });
  } else if (url.pathname === "/api/twilio/live" || url.pathname === "/api/sip/live") {
    wssTelephony.handleUpgrade(request, socket, head, (ws) => {
      wssTelephony.emit("connection", ws, request);
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Let Vite HMR pass through in dev mode
  } else {
    socket.destroy();
  }
});

wssBrowser.on("connection", (ws: WebSocket) => {
  handleBrowserWebSocket(ws);
});

wssTelephony.on("connection", (ws: WebSocket, request) => {
  handleTelephonyWebSocket(ws, request);
});

// ─── Seed Default Personas ──────────────────────────────────────
async function seedDefaultPersonas(): Promise<void> {
  for (const persona of DEFAULT_PERSONAS) {
    await PersonaModel.findOneAndUpdate({ id: persona.id }, persona, { upsert: true, new: true });
    console.log(`[Seed] Seeded/updated default persona: ${persona.name}`);
  }
  const total = await PersonaModel.countDocuments({});
  console.log(`[Seed] Total personas in database: ${total}`);
}

// ─── Bootstrap ──────────────────────────────────────────────────
async function initializeServer() {
  try {
    console.log("[DB] Connecting to MongoDB...");
    await connectDatabase();
    await seedDefaultPersonas();
  } catch (dbErr) {
    console.error("[DB] Connection failed:", dbErr);
  }

  // Serve call recordings folder statically
  app.use("/recordings", express.static(path.join(process.cwd(), "recordings")));

  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Mounting Vite middleware in development...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving production static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

initializeServer().catch((error) => {
  console.error("[Server] Fatal bootstrap error:", error);
});
