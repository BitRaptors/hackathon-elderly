import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Mic, X, MessageSquare, ChevronDown } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";

// --- Types ---
type AppState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface TranscriptItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface PhotoResult {
  imageUrl: string;
  product: string;
  confidence: number;
  description?: string;
}

const AGENT_ID = "agent_4701kc7bcjj3erktw61fc9bqzkcc";

// --- Custom Icons ---

const EarIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
    <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 0 4 0v-1a3 3 0 0 0-6 0v1a8 8 0 0 1-6 0v-1a6 6 0 0 1 12 0v1" opacity="0" />
  </svg>
);

const MouthIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M15.4 15.63a6 6 0 0 1-6.8 0" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
  </svg>
);

// --- Hooks ---

function useVoiceAssistantState() {
  const [currentState, setCurrentState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const addTranscript = (role: 'user' | 'assistant', text: string) => {
    setTranscript(prev => [...prev, { role, text, timestamp: new Date() }]);
  };

  const startConversation = () => {
    setCurrentState('listening');
  };

  const stopConversation = () => {
    setCurrentState('idle');
  };

  return {
    currentState,
    setCurrentState,
    transcript,
    startConversation,
    stopConversation,
    addTranscript
  };
}

export default function VoiceAssistant() {
  const { currentState, setCurrentState, transcript, startConversation, stopConversation, addTranscript } = useVoiceAssistantState();
  
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Additional state for ElevenLabs features
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);
  const [vadScore, setVadScore] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  
  // Store resolve/reject for agent tool calls
  const photoPromiseRef = useRef<{
    resolve: (value: PhotoResult) => void;
    reject: (reason?: any) => void;
  } | null>(null);

  // Handler for photo capture
  const handlePhotoCapture = async (file: File): Promise<PhotoResult> => {
    console.group("📷 handlePhotoCapture");
    console.log("Timestamp:", new Date().toISOString());
    console.log("File info:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    
    setIsProcessingPhoto(true);
    setPhotoResult(null);
    
    try {
      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file);
      console.log("✅ Created image URL:", imageUrl);
      
      // Simulate processing time
      console.log("⏳ Simulating processing (1.5s)...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Use mock data instead of API call
      const mockData: PhotoResult = {
        imageUrl,
        product: "Samsung QE75Q60B",
        confidence: 0.95,
        description: "75-inch QLED 4K Smart TV",
      };
      
      console.log("✅ Mock data generated:", mockData);
      setPhotoResult(mockData);
      
      // Add message to transcript showing the result
      addTranscript('assistant', `📸 Photo captured! I've identified this as: ${mockData.product}`);
      
      console.log("✅ Photo capture completed successfully");
      console.groupEnd();
      return mockData;
    } catch (error) {
      console.error('❌ Error processing photo:', error);
      setError('Failed to process photo. Please try again.');
      console.groupEnd();
      throw error;
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // ElevenLabs conversation hook
  const conversation = useConversation({
    // Set output volume to ensure audio plays (0.0 to 1.0)
    volume: 1.0,
    clientTools: {
      takePhoto: async () => {
        console.group("📸 takePhoto Tool Called");
        console.log("Timestamp:", new Date().toISOString());
        console.log("Triggering file input for photo capture...");
        
        return new Promise<string>((resolve, reject) => {
          // Store the promise handlers that will convert PhotoResult to JSON
          photoPromiseRef.current = { 
            resolve: (result: PhotoResult) => {
              console.log("📸 Photo captured, processing result...");
              console.log("PhotoResult:", result);
              
              // Convert PhotoResult to JSON string for the agent
              // Exclude imageUrl as it's a blob URL not useful to the agent
              const agentResult = {
                product: result.product,
                confidence: result.confidence,
                description: result.description,
              };
              
              const jsonResult = JSON.stringify(agentResult);
              console.log("📸 Sending to agent:", jsonResult);
              console.groupEnd();
              
              resolve(jsonResult);
            },
            reject: (error) => {
              console.error("📸 Photo capture failed:", error);
              console.groupEnd();
              reject(error);
            }
          };
          
          // Add message to transcript
          addTranscript('assistant', "📸 Please take or upload a photo of the product...");
          
          // Trigger file input
          if (fileInputRef.current) {
            fileInputRef.current.click();
            console.log("✅ File input triggered");
          } else {
            console.error("❌ File input not available");
            photoPromiseRef.current = null;
            reject(new Error('File input not available'));
            console.groupEnd();
          }
        });
      },
    },
    onConnect: () => {
      console.log("✅ Connected to ElevenLabs");
      setIsConnecting(false);
      setError(null);
      // Clear messages on new connection
      setCurrentState('listening');
      setPhotoResult(null);
      
      // Start checking input and output volume
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current);
      }
      volumeCheckInterval.current = setInterval(() => {
        try {
          const inputVol = conversation.getInputVolume();
          setInputVolume(inputVol);
        } catch (err) {
          // getInputVolume might not be available in all modes
        }
        try {
          const outputVol = conversation.getOutputVolume();
          setOutputVolume(outputVol);
        } catch (err) {
          // getOutputVolume might not be available in all modes
        }
      }, 100);
      
      // Log audio context status for debugging
      console.log("🔊 Audio context status:", {
        isSpeaking: conversation.isSpeaking,
        status: conversation.status,
      });
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      setIsConnecting(false);
      setCurrentState('idle');
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current);
        volumeCheckInterval.current = null;
      }
      setInputVolume(10);
      setOutputVolume(10);
      setVadScore(0);
      setIsListening(false);
    },
    onVadScore: ({ vadScore }) => {
      setVadScore(vadScore);
      setIsListening(vadScore > 0.3); // Consider listening if VAD score is above threshold
    },
    onModeChange: ({ mode }) => {
      // Mode can be "listening" or "speaking"
      setIsListening(mode === "listening");
      console.log("🔄 Mode changed:", mode);
      if (mode === "speaking") {
        console.log("🔊 Agent is now speaking");
      }
    },
    onMessage: ({ message, source }) => {
      // Enhanced logging for debugging
      const timestamp = new Date().toISOString();
      console.group("📨 onMessage Event");
      console.log("Timestamp:", timestamp);
      console.log("Source:", source);
      console.log("Message type:", typeof message);
      console.log("Message value:", message);
      
      // Log full message object if it's an object
      if (typeof message === "object" && message !== null) {
        console.log("Message object keys:", Object.keys(message));
        console.log("Full message object:", JSON.stringify(message, null, 2));
      }
      
      // Extract message content and role from the message object
      const content = message;
      const role: "user" | "assistant" = source === "user" ? "user" : "assistant";
      
      console.log("Extracted content:", content);
      console.log("Extracted role:", role);
      console.log("Content length:", typeof content === "string" ? content.length : "N/A");
      console.log("Content trimmed length:", typeof content === "string" ? content.trim().length : "N/A");
      
      // Only add non-empty messages
      if (typeof content === "string" && content.trim()) {
        console.log("✅ Adding message to transcript");
        console.log("Role:", role);
        console.log("Content:", content.trim());
        addTranscript(role, content.trim());
      } else {
        console.log("⏭️ Skipping message (empty or invalid)");
        if (typeof content !== "string") {
          console.warn("⚠️ Content is not a string, type:", typeof content);
        }
      }
      console.groupEnd();
    },
    onError: (error: unknown) => {
      console.error("❌ ElevenLabs error:", error);
      let errorMessage = "An error occurred";
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      setError(errorMessage);
      setIsConnecting(false);
      setCurrentState('idle');
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current);
        volumeCheckInterval.current = null;
      }
    },
  });

  // Sync UI state with ElevenLabs status
  useEffect(() => {
    if (conversation.status === 'connected') {
      if (conversation.isSpeaking) {
        console.log("🔊 Agent is speaking - updating UI to speaking state");
        setCurrentState('speaking');
      } else {
        // Connected but not speaking = listening
        setCurrentState('listening');
      }
    } else if (conversation.status === 'disconnected') {
      setCurrentState('idle');
    }
  }, [conversation.status, conversation.isSpeaking]);
  
  // Monitor speaking state changes
  useEffect(() => {
    if (conversation.status === 'connected') {
      console.log("🔊 Speaking state:", conversation.isSpeaking);
    }
  }, [conversation.isSpeaking, conversation.status]);

  // Request microphone permission on mount and unlock audio context
  useEffect(() => {
    const requestMicPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermissionGranted(true);
        
        // Unlock audio context by creating a temporary audio context
        // This helps with browser autoplay policies
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const audioContext = new AudioContext();
            if (audioContext.state === 'suspended') {
              // Resume audio context on user interaction
              const unlockAudio = () => {
                audioContext.resume().then(() => {
                  console.log("🔊 Audio context unlocked");
                  document.removeEventListener('click', unlockAudio);
                  document.removeEventListener('touchstart', unlockAudio);
                });
              };
              document.addEventListener('click', unlockAudio, { once: true });
              document.addEventListener('touchstart', unlockAudio, { once: true });
            }
          }
        } catch (audioErr) {
          console.warn("Could not unlock audio context:", audioErr);
        }
      } catch (err) {
        console.error("Microphone permission denied:", err);
        setError("Microphone permission is required for voice chat");
      }
    };
    requestMicPermission();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current);
      }
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, showTranscript]);

  // Send user activity when scrolling transcript to prevent agent interruptions
  useEffect(() => {
    if (conversation.status !== 'connected') return;

    // Use a ref to find the transcript container more reliably
    const transcriptContainer = transcriptEndRef.current?.parentElement;
    if (!transcriptContainer) return;

    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Debounce scroll events
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        conversation.sendUserActivity();
      }, 100);
    };

    transcriptContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      transcriptContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [conversation.status === 'connected', conversation]);

  // Camera access
  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      .then(stream => {
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera access denied:", err);
        alert("Camera access is required for this feature.");
        setShowCamera(false);
      });
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  const handleMainAction = async () => {
    if (currentState === 'idle') {
      console.log("🚀 Starting conversation...");
      setIsConnecting(true);
      setError(null);

      // Use agent ID from Voice-Test or environment variable
      const agentId = (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined) || AGENT_ID;
      console.log("📋 Using agent ID:", agentId);

      try {
        // Request fresh microphone access with proper constraints
        // This ensures we have permission before starting the session
        console.log("🎤 Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000, // Common sample rate for voice
          }
        });
        
        setMicPermissionGranted(true);
        
        // Don't hold onto this stream - let the SDK manage it
        // The SDK will request its own stream
        stream.getTracks().forEach(track => track.stop());
        
        console.log("✅ Microphone permission granted, starting session...");
        
        // Try WebRTC first (better for real-time audio)
        await conversation.startSession({
          agentId: agentId,
          connectionType: "webrtc",
          userId: "voice-assistant-user",
        });
        
        console.log("✅ WebRTC session started");
      } catch (err) {
        console.error("❌ WebRTC failed, trying WebSocket:", err);
        try {
          // Fallback to WebSocket
          await conversation.startSession({
            agentId: agentId,
            connectionType: "websocket",
            userId: "voice-assistant-user",
          });
          console.log("✅ WebSocket session started");
        } catch (wsErr) {
          console.error("❌ Both connection types failed:", wsErr);
          const errorMessage = wsErr instanceof Error ? wsErr.message : "Failed to start conversation";
          setError(errorMessage);
          setIsConnecting(false);
          setCurrentState('idle');
        }
      }
    } else {
      // Stop conversation
      console.log("🛑 Stopping conversation...");
      try {
        // Notify agent of user activity before ending
        conversation.sendUserActivity();
        await conversation.endSession();
        stopConversation();
        if (volumeCheckInterval.current) {
          clearInterval(volumeCheckInterval.current);
          volumeCheckInterval.current = null;
        }
        console.log("✅ Conversation stopped");
      } catch (err) {
        console.error("❌ Failed to end conversation:", err);
      }
    }
  };

  const handleCameraCapture = async () => {
    if (!videoRef.current) return;
    
    setIsScanning(true);

    try {
      // Capture frame from video
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setIsScanning(false);
            return;
          }
          
          try {
            // Create File from blob
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            await handlePhotoCapture(file);
            
            setTimeout(() => {
              setIsScanning(false);
              setShowCamera(false);
            }, 1500);
          } catch (error) {
            console.error("Error processing camera capture:", error);
            setIsScanning(false);
          }
        }, 'image/jpeg', 0.8);
      }
    } catch (error) {
      console.error("Camera capture error:", error);
      setIsScanning(false);
    }
  };

  return (
    // Outer Container
    <div className="min-h-screen min-h-dvh w-full bg-background md:bg-neutral-100 flex items-center justify-center font-sans md:p-8">
      
      {/* Mobile Device Container */}
      <div className="w-full min-h-screen min-h-dvh md:max-w-[430px] md:min-h-0 md:h-[850px] md:max-h-[95vh] bg-background md:rounded-[2.5rem] md:shadow-2xl md:border-[8px] border-white md:ring-1 ring-black/5 overflow-hidden relative flex flex-col items-center selection:bg-primary/20">
        
        {/* Hidden file input for photo capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            console.group("📁 File Input onChange");
            console.log("Timestamp:", new Date().toISOString());
            
            const file = e.target.files?.[0];
            if (file) {
              console.log("✅ File selected:", {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: new Date(file.lastModified).toISOString(),
              });
              
              try {
                console.log("🔄 Processing photo...");
                const photoResult = await handlePhotoCapture(file);
                console.log("✅ Photo processed successfully:", photoResult);
                
                // If this was triggered by the agent, resolve the promise with the full PhotoResult
                if (photoPromiseRef.current) {
                  console.log("📸 Resolving agent promise with PhotoResult");
                  photoPromiseRef.current.resolve(photoResult);
                  photoPromiseRef.current = null;
                } else {
                  console.log("ℹ️ No agent promise pending (manual upload)");
                }
              } catch (error) {
                console.error('❌ Error handling photo:', error);
                // If this was triggered by the agent, reject the promise
                if (photoPromiseRef.current) {
                  console.log("📸 Rejecting agent promise due to error");
                  photoPromiseRef.current.reject(error);
                  photoPromiseRef.current = null;
                }
              }
              // Reset input so the same file can be selected again
              e.target.value = '';
            } else {
              console.log("⚠️ No file selected");
              if (photoPromiseRef.current) {
                // User cancelled the file selection
                console.log("📸 Rejecting agent promise - user cancelled");
                photoPromiseRef.current.reject(new Error('No file selected'));
                photoPromiseRef.current = null;
              }
            }
            console.groupEnd();
          }}
        />
        
        {/* Status Bar Shim (only on desktop preview) */}
        <div className="w-full h-8 absolute top-0 left-0 bg-transparent z-50 flex justify-center pt-2 hidden md:flex">
            <div className="w-24 h-6 bg-black/5 rounded-full blur-xl" /> 
        </div>

        {/* --- Main Interaction Area --- */}
        <main className="flex-1 w-full flex flex-col items-center justify-end relative z-10 pb-4">
          
          <AnimatePresence mode="wait">
            
            {/* IDLE STATE */}
            {currentState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-6"
              >
                <button
                  onClick={handleMainAction}
                  data-testid="button-talk"
                  className="group relative cursor-pointer outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Tap to talk"
                  disabled={isConnecting}
                >
                  {/* Pulse Effect - Breathing */}
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-primary/20 blur-xl" 
                  />
                  
                  {/* Glow Pulse on Ring */}
                  <motion.div
                     animate={{ opacity: [0.3, 0.6, 0.3] }}
                     transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                     className="absolute inset-[-4px] rounded-full border-4 border-primary/30"
                  />
                  
                  <div className="relative w-64 h-64 rounded-full bg-white shadow-xl shadow-primary/10 flex items-center justify-center border-4 border-white transition-transform duration-300 group-hover:scale-105 active:scale-95">
                    <div className="w-56 h-56 rounded-full bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center">
                      <Mic className="w-24 h-24 text-primary stroke-[2.5]" />
                    </div>
                  </div>
                </button>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-semibold text-foreground/80 tracking-tight"
                >
                  {isConnecting ? "Connecting..." : "Tap to talk"}
                </motion.p>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md max-w-md"
                  >
                    <p className="text-sm text-red-800 font-medium">Error:</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* LISTENING STATE */}
            {currentState === 'listening' && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center gap-8"
              >
                <div onClick={handleMainAction} className="relative cursor-pointer">
                   
                  {/* Pulse Border */}
                  <motion.div
                    animate={{ scale: [1, 1.02, 1], borderColor: ["rgba(255,255,255,0)", "rgba(240, 100, 70, 0.2)", "rgba(255,255,255,0)"] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-[-8px] rounded-full border-4 border-primary/20"
                  />

                  <div className="relative w-64 h-64 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-primary/20 border-4 border-primary/5">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      {/* Inward Waves */}
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-8 h-16 border-l-4 border-primary rounded-l-full"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ 
                            opacity: [0, 1, 0],
                            x: [-10, 0, 5],
                            scale: [0.8, 1, 0.8]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.4,
                            ease: "easeInOut"
                          }}
                          style={{ marginLeft: i * -12 }}
                        />
                      ))}
                      
                      <motion.div
                         animate={{ rotate: [-2, 2, -2] }}
                         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      >
                         <EarIcon className="w-24 h-24 text-primary stroke-[3]" />
                      </motion.div>
                    </div>
                  </div>
                </div>
                <p className="text-3xl font-bold text-primary animate-pulse">
                  I'm listening...
                </p>
              </motion.div>
            )}

            {/* THINKING STATE */}
            {currentState === 'thinking' && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="w-64 h-64 rounded-full bg-white border-4 border-primary/10 flex items-center justify-center shadow-inner">
                  <div className="flex gap-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-5 h-5 rounded-full bg-primary"
                        animate={{
                          opacity: [0.3, 1, 0.3],
                          scale: [0.8, 1.2, 0.8]
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-3xl font-medium text-muted-foreground">Thinking...</p>
              </motion.div>
            )}

            {/* SPEAKING STATE */}
            {currentState === 'speaking' && (
              <motion.div
                key="speaking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-8"
                onClick={handleMainAction}
              >
                <div className="relative w-64 h-64 rounded-full bg-white shadow-2xl shadow-orange-500/10 flex items-center justify-center border-4 border-primary/5 cursor-pointer">
                   
                   <div className="relative w-32 h-32 flex items-center justify-center">
                      {/* Outward Waves - Right */}
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={`r-${i}`}
                          className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-8 h-16 border-r-4 border-primary rounded-r-full"
                          animate={{ 
                            opacity: [0.8, 0],
                            x: [0, 15],
                            scale: [1, 1.2]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeOut"
                          }}
                          style={{ marginRight: i * -12 }}
                        />
                      ))}

                      {/* Outward Waves - Left */}
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={`l-${i}`}
                          className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-8 h-16 border-l-4 border-primary rounded-l-full"
                          animate={{ 
                            opacity: [0.8, 0],
                            x: [0, -15],
                            scale: [1, 1.2]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeOut"
                          }}
                          style={{ marginLeft: i * -12 }}
                        />
                      ))}
                      
                      <motion.div
                         animate={{ y: [0, 3, 0] }}
                         transition={{ duration: 0.5, repeat: Infinity }}
                      >
                         <MouthIcon className="w-24 h-24 text-primary stroke-[3]" />
                      </motion.div>
                   </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                   <p className="text-2xl font-medium text-foreground">Speaking...</p>
                   <p className="text-base text-muted-foreground font-medium">Tap to stop</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Photo Result Display */}
          {photoResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-4 w-full max-w-sm mx-auto"
            >
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
            </motion.div>
          )}
          
          {/* Microphone Status Indicators (when connected) */}
          {conversation.status === 'connected' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 w-full max-w-sm mx-auto p-4 bg-blue-50 border border-blue-200 rounded-md"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-800">Microphone Status</p>
                <div className={cn(
                  "h-3 w-3 rounded-full",
                  inputVolume > 0.01 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                )} />
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
                <div>
                  <div className="flex justify-between text-xs text-blue-700 mb-1">
                    <span>Output Volume</span>
                    <span>{(outputVolume * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(outputVolume * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {inputVolume < 0.01 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ No audio input detected. Check your microphone settings.
                  </p>
                )}
                {outputVolume < 0.01 && conversation.isSpeaking && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ No audio output detected. Check your speakers/headphones and browser audio settings.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </main>

        {/* --- Bottom Controls --- */}
        <footer className="w-full px-6 pb-10 flex justify-between items-end z-20 h-32">
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="w-16 h-16 rounded-2xl bg-white border-2 border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors active:scale-95 outline-none focus:ring-4 focus:ring-primary/20"
              aria-label="Upload Photo"
              data-testid="button-photo-upload"
              disabled={isProcessingPhoto}
            >
              <Camera className="w-8 h-8 stroke-[2.5]" />
            </button>
            {isProcessingPhoto && (
              <p className="text-xs text-muted-foreground">Processing...</p>
            )}
          </div>

          {/* Transcript Toggle */}
          <button 
            onClick={() => setShowTranscript(true)}
            className="w-16 h-16 rounded-2xl bg-white border-2 border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors active:scale-95 outline-none focus:ring-4 focus:ring-primary/20"
            aria-label="View Transcript"
            data-testid="button-transcript"
          >
            <MessageSquare className="w-8 h-8 stroke-[2.5]" />
          </button>
        </footer>

        {/* --- Transcript Slide-up Panel --- */}
        <AnimatePresence>
          {showTranscript && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTranscript(false)}
                className="absolute inset-0 bg-black/20 z-40 backdrop-blur-sm"
              />
              
              {/* Panel */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 h-[60%] bg-white rounded-t-[2.5rem] z-50 flex flex-col shadow-2xl"
              >
                <div className="w-full h-12 flex items-center justify-center border-b border-border/50 relative shrink-0" onClick={() => setShowTranscript(false)}>
                   <div className="w-12 h-1.5 bg-neutral-200 rounded-full" />
                   <button 
                     onClick={() => setShowTranscript(false)}
                     className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground p-2"
                   >
                     <ChevronDown className="w-6 h-6" />
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No conversation yet. Tap the button to start talking!</p>
                    </div>
                  ) : (
                    <>
                      {transcript.map((msg, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "flex w-full",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                          )}
                        >
                          <div className={cn(
                            "max-w-[80%] p-4 rounded-2xl text-lg font-medium leading-snug",
                            msg.role === 'user' 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-neutral-100 text-foreground rounded-bl-sm"
                          )}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <p className={cn(
                                "text-xs font-semibold",
                                msg.role === 'user' ? "text-primary-foreground/80" : "text-muted-foreground"
                              )}>
                                {msg.role === 'user' ? "You" : "Agent"}
                              </p>
                              <span className={cn(
                                "text-xs",
                                msg.role === 'user' ? "text-primary-foreground/60" : "text-muted-foreground/70"
                              )}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* --- Camera Overlay --- */}
        <AnimatePresence>
           {showCamera && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 bg-black flex flex-col"
             >
                {/* Header */}
                <div className="flex justify-end p-6">
                  <button 
                    onClick={() => setShowCamera(false)}
                    className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-md"
                    data-testid="button-camera-close"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Viewfinder Area */}
                <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
                   <p className="text-white/90 text-xl font-medium tracking-wide">Point at your TV</p>
                   
                   <div className="w-full aspect-video border-2 border-white/20 rounded-3xl relative overflow-hidden bg-neutral-900">
                      {/* Guide Corners */}
                      <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                      <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                      
                      {/* Live Camera Feed */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                   </div>
                </div>

                {/* Footer / Capture */}
                <div className="h-40 flex items-center justify-center pb-8">
                   <button 
                     onClick={handleCameraCapture}
                     className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group"
                     data-testid="button-camera-capture"
                     disabled={isProcessingPhoto}
                   >
                     <div className="w-16 h-16 rounded-full bg-white transition-transform group-active:scale-90" />
                   </button>
                </div>
                
                {/* Alternative: Upload from gallery */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-medium"
                    disabled={isProcessingPhoto}
                  >
                    📷 Upload from Gallery
                  </button>
                </div>

                {/* Scanning Overlay */}
                {isScanning && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
                  >
                     <div className="flex flex-col items-center gap-4">
                       <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                       <p className="text-white text-xl font-medium">Scanning...</p>
                     </div>
                  </motion.div>
                )}
             </motion.div>
           )}
        </AnimatePresence>

        {/* Background Decor */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-3xl -z-0 pointer-events-none" />
      </div>
    </div>
  );
}
