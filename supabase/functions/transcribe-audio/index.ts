const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Get limits from environment variables with fallbacks
const getFileSizeLimit = (): number => {
  const envLimit = Deno.env.get('MAX_FILE_SIZE_MB');
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

const getOpenAIChunkLimit = (): number => {
  const envLimit = Deno.env.get('OPENAI_CHUNK_SIZE_MB');
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 25 * 1024 * 1024; // Default 25MB
};

// Standard response format
interface ApiResponse<T = any> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
}

function createErrorResponse(code: string, message: string, status: number = 500): Response {
  const response: ApiResponse = {
    ok: false,
    code,
    message
  };
  
  return new Response(
    JSON.stringify(response),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function createSuccessResponse<T>(data: T): Response {
  const response: ApiResponse<T> = {
    ok: true,
    code: 'SUCCESS',
    message: 'Operation completed successfully',
    data
  };
  
  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

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
      return createErrorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
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
      return createErrorResponse('NO_FILE', 'No audio file provided', 400);
    }

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return createErrorResponse('INVALID_API_KEY', "Invalid OpenAI API key. Key should start with 'sk-'", 401);
    }

    // Check file size limits
    const fileSizeLimit = getFileSizeLimit();
    if (audioFile.size > fileSizeLimit) {
      const limitMB = Math.round(fileSizeLimit / 1024 / 1024);
      const fileMB = Math.round(audioFile.size / 1024 / 1024);
      return createErrorResponse('FILE_TOO_LARGE', `File size (${fileMB}MB) exceeds maximum allowed size (${limitMB}MB)`, 413);
    }

    console.log("Processing audio file:", audioFile.name, "Size:", audioFile.size);

    // Check OpenAI chunk size limits
    const openaiChunkLimit = getOpenAIChunkLimit();
    if (audioFile.size > openaiChunkLimit) {
      const limitMB = Math.round(openaiChunkLimit / 1024 / 1024);
      console.log(`Large file detected (${Math.round(audioFile.size / 1024 / 1024)}MB), OpenAI limit: ${limitMB}MB. Processing in segments...`);
      
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
      
      return createErrorResponse(
        'OPENAI_API_ERROR',
        errorData.error?.message || "OpenAI API error occurred",
        openaiResponse.status
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

    return createSuccessResponse(result);

  } catch (error) {
    console.error("Edge function error:", error);
    
    return createErrorResponse(
      'SERVER_ERROR',
      error instanceof Error ? error.message : 'Unknown server error'
    );
  }
});