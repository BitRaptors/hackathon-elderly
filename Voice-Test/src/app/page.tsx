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

interface PhotoResult {
  imageUrl: string
  product: string
  confidence: number
  description?: string
}

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [micPermissionGranted, setMicPermissionGranted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputVolume, setInputVolume] = useState(0)
  const [vadScore, setVadScore] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handler for photo capture
  const handlePhotoCapture = async (file: File): Promise<string> => {
    setIsProcessingPhoto(true)
    setPhotoResult(null)
    
    try {
      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file)
      
      // Create FormData for API call
      const formData = new FormData()
      formData.append('image', file)
      
      // Call mock API
      const response = await fetch('/api/identify-product', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to identify product')
      }
      
      const data = await response.json()
      
      // Store result with image preview
      const result: PhotoResult = {
        imageUrl,
        product: data.product,
        confidence: data.confidence,
        description: data.description,
      }
      setPhotoResult(result)
      
      // Add message to transcript showing the result
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `📸 Photo captured! I've identified this as: ${data.product}`,
          timestamp: new Date(),
        },
      ])
      
      return data.product
    } catch (error) {
      console.error('Error processing photo:', error)
      setError('Failed to process photo. Please try again.')
      throw error
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  // Store resolve/reject for agent tool calls
  const photoPromiseRef = useRef<{
    resolve: (value: string) => void
    reject: (reason?: any) => void
  } | null>(null)

  const conversation = useConversation({
    clientTools: {
      takePhoto: async () => {
        return new Promise<string>((resolve, reject) => {
          // Store the promise handlers
          photoPromiseRef.current = { resolve, reject }
          
          // Add message to transcript
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "📸 Please take or upload a photo of the product...",
              timestamp: new Date(),
            },
          ])
          
          // Trigger file input
          if (fileInputRef.current) {
            fileInputRef.current.click()
          } else {
            photoPromiseRef.current = null
            reject(new Error('File input not available'))
          }
        })
      },
    },
    onConnect: () => {
      setIsConnecting(false)
      setError(null)
      setMessages([]) // Clear messages on new connection
      setPhotoResult(null) // Clear photo result on new connection
      
      // Start checking input volume
      volumeCheckInterval.current = setInterval(() => {
        try {
          const volume = conversation.getInputVolume()
          setInputVolume(volume)
        } catch (err) {
          // getInputVolume might not be available in all modes
        }
      }, 100)
    },
    onDisconnect: () => {
      setIsConnecting(false)
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current)
        volumeCheckInterval.current = null
      }
      setInputVolume(0)
      setVadScore(0)
      setIsListening(false)
    },
    onVadScore: ({ vadScore }) => {
      setVadScore(vadScore)
      setIsListening(vadScore > 0.3) // Consider listening if VAD score is above threshold
    },
    onModeChange: ({ mode }) => {
      // Mode can be "listening" or "speaking"
      setIsListening(mode === "listening")
    },
    onMessage: ({ message, source }) => {
      // Log the raw message to see what we're receiving
      console.log("📨 onMessage received:", { message, source })
      
      // Extract message content and role from the message object
      const content = message
      const role: "user" | "assistant" = source === "user" ? "user" : "assistant"
      
      console.log("📨 Final parsed values:", { content, role })
      
      // Only add non-empty messages
      if (content.trim()) {
        console.log("📨 Adding message to transcript:", { role, content: content.trim() })
        setMessages((prev) => [
          ...prev,
          {
            role,
            content: content.trim(),
            timestamp: new Date(),
          },
        ])
      } else {
        console.log("📨 Skipping empty message")
      }
    },
    onError: (error) => {
      console.error("Error:", error)
      setError(typeof error === "string" ? error : "An error occurred")
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
      // Request fresh microphone access with proper constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Common sample rate for voice
        }
      })
      
      // Don't hold onto this stream - let the SDK manage it
      // The SDK will request its own stream
      stream.getTracks().forEach(track => track.stop())
      
      // Try WebRTC first (better for real-time audio)
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
        userId: "oldManBrad",
      })
    } catch (err) {
      try {
        // Fallback to WebSocket
        await conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "websocket",
          userId: "oldManBrad",
        })
      } catch (wsErr) {
        console.error("Both connection types failed:", wsErr)
        setError(wsErr instanceof Error ? wsErr.message : "Failed to start conversation")
        setIsConnecting(false)
      }
    }
  }

  const handleEndConversation = async () => {
    try {
      // Notify agent of user activity before ending
      conversation.sendUserActivity()
      await conversation.endSession()
      setMessages([]) // Clear messages when ending conversation
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current)
        volumeCheckInterval.current = null
      }
    } catch (err) {
      console.error("Failed to end conversation:", err)
    }
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current)
      }
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const isConnected = conversation.status === "connected"
  const isSpeaking = conversation.isSpeaking

  // Send user activity when scrolling transcript to prevent agent interruptions
  useEffect(() => {
    if (!isConnected) return

    // Use a ref to find the transcript container more reliably
    const transcriptContainer = transcriptEndRef.current?.parentElement
    if (!transcriptContainer) return

    let scrollTimeout: NodeJS.Timeout | null = null

    const handleScroll = () => {
      // Debounce scroll events
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      scrollTimeout = setTimeout(() => {
        conversation.sendUserActivity()
      }, 100)
    }

    transcriptContainer.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      transcriptContainer.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [isConnected, conversation])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-4">
        {/* Hidden file input for photo capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              try {
                const productName = await handlePhotoCapture(file)
                // If this was triggered by the agent, resolve the promise
                if (photoPromiseRef.current) {
                  photoPromiseRef.current.resolve(productName)
                  photoPromiseRef.current = null
                }
              } catch (error) {
                console.error('Error handling photo:', error)
                // If this was triggered by the agent, reject the promise
                if (photoPromiseRef.current) {
                  photoPromiseRef.current.reject(error)
                  photoPromiseRef.current = null
                }
              }
              // Reset input so the same file can be selected again
              e.target.value = ''
            } else if (photoPromiseRef.current) {
              // User cancelled the file selection
              photoPromiseRef.current.reject(new Error('No file selected'))
              photoPromiseRef.current = null
            }
          }}
        />
        
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
              {isListening && (
                <p className="text-sm text-blue-700 mt-1">
                  🎤 Listening for your voice...
                </p>
              )}
            </div>

            {/* Microphone Status */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-800">Microphone Status</p>
                <div className={`h-3 w-3 rounded-full ${inputVolume > 0.01 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-blue-700 mb-1">
                    <span>Input Volume</span>
                    <span>{(inputVolume * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(inputVolume * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-blue-700 mb-1">
                    <span>Voice Activity (VAD)</span>
                    <span>{(vadScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(vadScore * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {inputVolume < 0.01 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ No audio input detected. Check your microphone settings.
                  </p>
                )}
              </div>
            </div>

            {/* Photo Result Display */}
            {photoResult && (
              <div className="border border-green-200 rounded-md bg-green-50 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-3">
                  📸 Product Identified
                </h3>
                <div className="space-y-3">
                  <img
                    src={photoResult.imageUrl}
                    alt="Captured product"
                    className="w-full h-48 object-cover rounded-md"
                  />
                  <div className="bg-white p-3 rounded-md border border-green-200">
                    <p className="text-lg font-bold text-gray-900">
                      {photoResult.product}
                    </p>
                    {photoResult.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {photoResult.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Confidence: {(photoResult.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessingPhoto && (
              <div className="border border-blue-200 rounded-md bg-blue-50 shadow-sm p-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <p className="text-sm text-blue-800">
                    Processing photo and identifying product...
                  </p>
                </div>
              </div>
            )}

            {/* Transcript Display */}
            <div className="border border-gray-200 rounded-md bg-white shadow-sm">
              <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Conversation Transcript</h2>
                {messages.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {messages.length} {messages.length === 1 ? "message" : "messages"}
                  </span>
                )}
              </div>
              <div className="h-64 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-gray-500 mb-2">
                      Conversation transcript will appear here...
                    </p>
                    <p className="text-xs text-gray-400">
                      Start speaking to see your messages
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-3 shadow-sm ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-800 border border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className={`text-xs font-semibold ${
                            message.role === "user" ? "text-blue-100" : "text-gray-500"
                          }`}>
                            {message.role === "user" ? "You" : "Agent"}
                          </p>
                          <span className={`text-xs ${
                            message.role === "user" ? "text-blue-200" : "text-gray-400"
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                          message.role === "user" ? "text-white" : "text-gray-700"
                        }`}>
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click()
                  }
                }}
                variant="outline"
                className="flex-1"
                disabled={isProcessingPhoto}
              >
                📸 Test Photo Upload
              </Button>
              <Button
                onClick={handleEndConversation}
                variant="outline"
                className="flex-1"
              >
                End Conversation
              </Button>
            </div>
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
