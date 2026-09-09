import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";

const app: Express = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, "../../codebase-intelligence/dist/public");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built React application from the same Express process.
app.use(express.static(frontendDist));

// SPA fallback: let React Router handle client-side routes.
app.get("*splat", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
