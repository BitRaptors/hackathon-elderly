import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";

const cameraWebhookSchema = z.object({
  imageData: z.string(),
  timestamp: z.string().optional(),
});

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server | null,
  app: Express
): Promise<Server | null> {
  
  // Camera scan webhook endpoint
  app.post("/api/camera/scan", async (req, res) => {
    try {
      const { imageData, timestamp } = cameraWebhookSchema.parse(req.body);
      
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      
      if (!n8nWebhookUrl) {
        console.warn("N8N_WEBHOOK_URL not configured, skipping webhook");
        return res.json({ 
          success: true, 
          message: "Image received (webhook not configured)" 
        });
      }

      // Forward to n8n webhook
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData,
          timestamp: timestamp || new Date().toISOString(),
          source: "elderly-voice-assistant",
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      res.json({ 
        success: true, 
        message: "Image sent to processing pipeline",
        webhookResponse: result 
      });
      
    } catch (error) {
      console.error("Camera scan error:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Text-to-speech endpoint
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text, language = "en" } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      if (language !== "en" && language !== "hu") {
        return res.status(400).json({ error: "Language must be 'en' or 'hu'" });
      }

      const apiKey = process.env.ELEVEN_LABS_KEY || process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      // Voice IDs for different languages
      // English: Rachel (21m00Tcm4TlvDq8ikWAM)
      // Hungarian: Use multilingual model with a voice that supports Hungarian
      const voiceId = language === "hu" 
        ? "EXAVITQu4vr4xnSDxMaL" // Bella - supports multiple languages including Hungarian
        : "21m00Tcm4TlvDq8ikWAM"; // Rachel - English
      
      // Use multilingual model for Hungarian, monolingual for English
      const modelId = language === "hu"
        ? "eleven_multilingual_v2"
        : "eleven_monolingual_v1";
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        console.error("ElevenLabs API error:", errorData);
        console.error("Response status:", response.status);
        
        // Provide helpful error message for permission issues
        if (response.status === 401 && errorData.detail?.status === "missing_permissions") {
          return res.status(401).json({
            error: "API key missing text_to_speech permission",
            message: "Please check your API key permissions in the ElevenLabs dashboard and ensure 'Text to Speech' is enabled.",
            details: errorData,
          });
        }
        
        return res.status(response.status).json({
          error: "Failed to generate speech",
          details: errorData,
        });
      }

      const audioBuffer = await response.arrayBuffer();

      res.setHeader("Content-Type", "audio/mpeg");
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error in text-to-speech route:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Product identification endpoint
  app.post("/api/identify-product", upload.single("image"), async (req, res) => {
    try {
      // In a real implementation, we would:
      // 1. Extract the image from req.file
      // 2. Send it to an AI vision API (like OpenAI Vision, Google Cloud Vision, etc.)
      // 3. Return the actual product identification result
      
      // For now, we'll simulate processing time and return mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      res.json({
        product: "Samsung QE75Q60B",
        confidence: 0.95,
        description: "75-inch QLED 4K Smart TV",
      });
    } catch (error) {
      console.error("Error identifying product:", error);
      res.status(500).json({ error: "Failed to identify product" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok",
      elevenLabsConfigured: !!(process.env.ELEVENLABS_AGENT_ID),
      n8nConfigured: !!(process.env.N8N_WEBHOOK_URL),
    });
  });

  return httpServer;
}
