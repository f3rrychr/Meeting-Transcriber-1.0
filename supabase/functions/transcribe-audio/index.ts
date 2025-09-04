import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Get the form data from the request
    const formData = await req.formData()
    const audioFile = formData.get("file") as File
    const apiKey = formData.get("apiKey") as string

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return new Response(
        JSON.stringify({ error: "Invalid OpenAI API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Processing audio file:", audioFile.name, "Size:", audioFile.size)

    // Check file size (OpenAI limit is 25MB)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (audioFile.size > maxSize) {
      return new Response(
        JSON.stringify({ 
          error: `File too large. Maximum size is 25MB, received ${Math.round(audioFile.size / 1024 / 1024)}MB` 
        }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Prepare form data for OpenAI API
    const openaiFormData = new FormData()
    openaiFormData.append("file", audioFile)
    openaiFormData.append("model", "whisper-1")
    openaiFormData.append("response_format", "verbose_json")
    openaiFormData.append("timestamp_granularities[]", "segment")

    console.log("Sending request to OpenAI Whisper API...")

    // Call OpenAI Whisper API
    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error("OpenAI API error:", errorData)
      
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || `OpenAI API error: ${openaiResponse.status}`,
          statusCode: openaiResponse.status 
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const transcriptionData = await openaiResponse.json()
    console.log("OpenAI transcription completed successfully")

    // Format the response to match our expected structure
    const formatTimestamp = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)
      
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const segments = transcriptionData.segments?.map((segment: any) => ({
      text: segment.text.trim(),
      timestamp: formatTimestamp(segment.start),
      duration: segment.end - segment.start,
    })) || []

    // For now, assign all segments to a single speaker since Whisper doesn't do diarization
    const speakers = [{
      id: 'Speaker_1',
      segments: segments
    }]

    const result = {
      speakers,
      meetingDate: new Date().toLocaleDateString(),
      meetingTitle: audioFile.name.replace(/\.[^/.]+$/, ""),
      duration: formatDuration(transcriptionData.duration || 0),
      wordCount: segments.reduce((count: number, segment: any) => count + segment.text.split(' ').length, 0)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (error) {
    console.error("Edge function error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})