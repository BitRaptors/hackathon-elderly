import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Determine the path to static files
  // On Vercel, use process.cwd() since __dirname points to the serverless function location
  // For local builds, use __dirname which points to dist/
  const isVercel = !!process.env.VERCEL;
  const distPath = isVercel 
    ? path.resolve(process.cwd(), "dist", "public")
    : path.resolve(__dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (for client-side routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
