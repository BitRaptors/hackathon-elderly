import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, language = "en" } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      )
    }

    if (language !== "en" && language !== "hu") {
      return NextResponse.json(
        { error: "Language must be 'en' or 'hu'" },
        { status: 400 }
      )
    }

    const apiKey = process.env.ELEVEN_LABS_KEY || process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      )
    }

    // Voice IDs for different languages
    // English: Rachel (21m00Tcm4TlvDq8ikWAM)
    // Hungarian: Use multilingual model with a voice that supports Hungarian
    const voiceId = language === "hu" 
      ? "EXAVITQu4vr4xnSDxMaL" // Bella - supports multiple languages including Hungarian
      : "21m00Tcm4TlvDq8ikWAM" // Rachel - English
    
    // Use multilingual model for Hungarian, monolingual for English
    const modelId = language === "hu"
      ? "eleven_multilingual_v2"
      : "eleven_monolingual_v1"
    
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
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      
      console.error("ElevenLabs API error:", errorData)
      console.error("Response status:", response.status)
      
      // Provide helpful error message for permission issues
      if (response.status === 401 && errorData.detail?.status === "missing_permissions") {
        return NextResponse.json(
          { 
            error: "API key missing text_to_speech permission",
            message: "Please check your API key permissions in the ElevenLabs dashboard and ensure 'Text to Speech' is enabled.",
            details: errorData
          },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to generate speech", details: errorData },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    console.error("Error in text-to-speech route:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
