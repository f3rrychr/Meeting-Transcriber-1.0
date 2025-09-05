const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          error: "Method not allowed",
          statusCode: 405,
          apiType: "supabase"
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the form data from the request
    const formData = await req.formData();
    const audioFile = formData.get("file") as File;
    const apiKey = formData.get("apiKey") as string;

    console.log("Edge function received request:", {
      hasFile: !!audioFile,
      fileName: audioFile?.name,
      fileSize: audioFile?.size,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 3)
    });

    if (!audioFile) {
      return new Response(
        JSON.stringify({ 
          error: "No audio file provided",
          statusCode: 400,
          apiType: "supabase"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid OpenAI API key. Key should start with 'sk-'",
          statusCode: 401,
          apiType: "openai"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Processing audio file:", audioFile.name, "Size:", audioFile.size);

    // Handle large files by processing them in chunks if needed
    let processedFile = audioFile;
    
    // For files larger than OpenAI's limit, we need to chunk or compress
    const openaiMaxSize = 25 * 1024 * 1024; // 25MB - OpenAI's actual limit
    if (audioFile.size > openaiMaxSize) {
      console.log(`Large file detected (${Math.round(audioFile.size / 1024 / 1024)}MB). Processing in segments...`);
      
      // For now, we'll try to process the file directly and let OpenAI handle it
      // In a production environment, you might want to:
      // 1. Split the audio into chunks
      // 2. Process each chunk separately
      // 3. Combine the results
      // 4. Or use a different transcription service for large files
      
      console.log("Attempting to process large file directly...");
    }

    // Prepare form data for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append("file", audioFile);
    openaiFormData.append("model", "whisper-1");
    openaiFormData.append("response_format", "verbose_json");
    openaiFormData.append("timestamp_granularities[]", "segment");

    console.log("Sending request to OpenAI Whisper API...");

    // Call OpenAI Whisper API
    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    });

    console.log("OpenAI API response status:", openaiResponse.status);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || "OpenAI API error occurred",
          statusCode: openaiResponse.status,
          apiType: "openai",
          details: errorData.error?.type || undefined
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transcriptionData = await openaiResponse.json();
    console.log("OpenAI transcription completed successfully");

    // Format the response to match our expected structure
    const formatTimestamp = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const segments = transcriptionData.segments?.map((segment: any) => ({
      text: segment.text.trim(),
      timestamp: formatTimestamp(segment.start),
      duration: segment.end - segment.start,
    })) || [];

    // For now, assign all segments to a single speaker since Whisper doesn't do diarization
    const speakers = [{
      id: 'Speaker_1',
      segments: segments
    }];

    const result = {
      speakers,
      meetingDate: new Date().toLocaleDateString(),
      meetingTitle: audioFile.name.replace(/\.[^/.]+$/, ""),
      duration: formatDuration(transcriptionData.duration || 0),
      wordCount: segments.reduce((count: number, segment: any) => count + segment.text.split(' ').length, 0)
    };

    console.log("Returning formatted transcription result");

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown server error',
        statusCode: 500,
        apiType: "supabase"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});