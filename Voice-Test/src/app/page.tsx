"use client"

import { useState, useEffect, useRef } from "react"
import { useConversation } from "@elevenlabs/react"
import { Button } from "@/components/ui/button"

const AGENT_ID = "agent_4701kc7bcjj3erktw61fc9bqzkcc"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [micPermissionGranted, setMicPermissionGranted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to agent")
      setIsConnecting(false)
      setError(null)
      setMessages([]) // Clear messages on new connection
    },
    onDisconnect: () => {
      console.log("Disconnected from agent")
      setIsConnecting(false)
    },
    onMessage: (message) => {
      console.log("Message:", message)
      
      // Extract message content and role from the message object
      // The message structure may vary, so we handle different formats
      let content = ""
      let role: "user" | "assistant" = "assistant"
      
      if (typeof message === "string") {
        content = message
      } else if (message && typeof message === "object") {
        // Handle different message formats
        content = message.content || message.text || message.message || JSON.stringify(message)
        
        // Determine role based on message properties
        if (message.role) {
          role = message.role === "user" ? "user" : "assistant"
        } else if (message.type === "user_message" || message.type === "user_transcription") {
          role = "user"
        } else if (message.type === "assistant_message" || message.type === "agent_message") {
          role = "assistant"
        }
      }
      
      // Only add non-empty messages
      if (content.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            role,
            content: content.trim(),
            timestamp: new Date(),
          },
        ])
      }
    },
    onError: (error) => {
      console.error("Error:", error)
      setError(error.message || "An error occurred")
      setIsConnecting(false)
    },
  })

  // Request microphone permission on mount
  useEffect(() => {
    const requestMicPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        setMicPermissionGranted(true)
      } catch (err) {
        console.error("Microphone permission denied:", err)
        setError("Microphone permission is required for voice chat")
      }
    }
    requestMicPermission()
  }, [])

  const handleStartConversation = async () => {
    if (!micPermissionGranted) {
      setError("Please allow microphone access first")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc", // or "websocket"
      })
    } catch (err) {
      console.error("Failed to start conversation:", err)
      setError(err instanceof Error ? err.message : "Failed to start conversation")
      setIsConnecting(false)
    }
  }

  const handleEndConversation = async () => {
    try {
      await conversation.endSession()
      setMessages([]) // Clear messages when ending conversation
    } catch (err) {
      console.error("Failed to end conversation:", err)
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const isConnected = conversation.status === "connected"
  const isSpeaking = conversation.isSpeaking

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center mb-8">
          ElevenLabs Agent Chat
        </h1>

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-center text-gray-600">
              {micPermissionGranted
                ? "Click the button below to start a voice conversation with the agent"
                : "Please allow microphone access to continue"}
            </p>

            <Button
              onClick={handleStartConversation}
              disabled={isConnecting || !micPermissionGranted}
              className="w-full"
            >
              {isConnecting ? "Connecting..." : "Start Conversation"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 font-medium">
                ✓ Connected to agent
              </p>
              {isSpeaking && (
                <p className="text-sm text-green-700 mt-1">
                  Agent is speaking...
                </p>
              )}
            </div>

            {/* Transcript Display */}
            <div className="border border-gray-200 rounded-md bg-white">
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-800">Transcript</h2>
              </div>
              <div className="h-64 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Conversation transcript will appear here...
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 opacity-75">
                          {message.role === "user" ? "You" : "Agent"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            <Button
              onClick={handleEndConversation}
              variant="outline"
              className="w-full"
            >
              End Conversation
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">Error:</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-600">
            <strong>Status:</strong> {conversation.status || "disconnected"}
          </p>
          {conversation.getId() && (
            <p className="text-xs text-gray-600 mt-1">
              <strong>Conversation ID:</strong> {conversation.getId()}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
