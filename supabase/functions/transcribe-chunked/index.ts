const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ChunkedTranscribeRequest {
  uploadId: string;
  storagePath: string;
  apiKey: string;
  chunkSize?: number; // in seconds
  maxChunkSize?: number; // in bytes
}

interface TranscriptionChunk {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  text: string;
  segments: Array<{
    text: string;
    timestamp: string;
    duration: number;
  }>;
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

    const requestData: ChunkedTranscribeRequest = await req.json();
    const { uploadId, storagePath, apiKey, chunkSize = 300, maxChunkSize = 25 * 1024 * 1024 } = requestData;

    console.log("Chunked transcribe function received request:", {
      uploadId,
      storagePath,
      hasApiKey: !!apiKey,
      chunkSize,
      maxChunkSize
    });

    if (!uploadId || !storagePath) {
      return new Response(
        JSON.stringify({ 
          error: "Missing uploadId or storagePath",
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

    // Initialize Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download file from storage
    console.log(`Downloading file from storage: ${storagePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-files')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to download file from storage: ${downloadError?.message || 'File not found'}`,
          statusCode: 404,
          apiType: "supabase"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileSize = fileData.size;
    console.log(`Downloaded file size: ${Math.round(fileSize / 1024 / 1024)}MB`);

    // Check if file needs chunking
    if (fileSize <= maxChunkSize) {
      console.log('File is small enough for direct transcription');
      return await transcribeDirectly(fileData, apiKey, storagePath);
    }

    console.log('File is large, using chunked transcription');
    return await transcribeInChunks(fileData, apiKey, storagePath, chunkSize, maxChunkSize, supabase, uploadId);

  } catch (error) {
    console.error("Chunked transcribe function error:", error);
    
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

// Direct transcription for small files
async function transcribeDirectly(fileData: Blob, apiKey: string, fileName: string) {
  console.log('Starting direct transcription');
  
  const formData = new FormData();
  formData.append("file", fileData, fileName);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "OpenAI API error occurred");
  }

  const transcriptionData = await openaiResponse.json();
  return formatTranscriptionResponse(transcriptionData, fileName);
}

// Chunked transcription for large files
async function transcribeInChunks(
  fileData: Blob, 
  apiKey: string, 
  fileName: string, 
  chunkDurationSeconds: number,
  maxChunkSize: number,
  supabase: any,
  uploadId: string
) {
  console.log(`Starting chunked transcription with ${chunkDurationSeconds}s chunks`);
  
  // For now, we'll implement a simple byte-based chunking
  // In a production system, you'd want audio-aware chunking
  const chunks = await createFileChunks(fileData, maxChunkSize);
  console.log(`Created ${chunks.length} chunks`);

  const transcriptionChunks: TranscriptionChunk[] = [];
  let totalDuration = 0;

  // Process chunks sequentially to avoid rate limits
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${Math.round(chunk.size / 1024 / 1024)}MB)`);

    try {
      // Update progress in database
      await supabase
        .from('audio_uploads')
        .update({ 
          status: 'processing',
          progress: Math.round((i / chunks.length) * 100),
          current_chunk: i + 1,
          total_chunks: chunks.length
        })
        .eq('upload_id', uploadId);

      // Transcribe chunk
      const formData = new FormData();
      formData.append("file", chunk, `${fileName}_chunk_${i}.audio`);
      formData.append("model", "whisper-1");
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "segment");

      const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json().catch(() => ({}));
        throw new Error(`Chunk ${i + 1} failed: ${errorData.error?.message || "OpenAI API error"}`);
      }

      const chunkTranscription = await openaiResponse.json();
      
      // Process chunk transcription
      const chunkResult: TranscriptionChunk = {
        chunkIndex: i,
        startTime: totalDuration,
        endTime: totalDuration + (chunkTranscription.duration || 0),
        text: chunkTranscription.text || '',
        segments: chunkTranscription.segments?.map((segment: any) => ({
          text: segment.text.trim(),
          timestamp: formatTimestamp(totalDuration + segment.start),
          duration: segment.end - segment.start,
        })) || []
      };

      transcriptionChunks.push(chunkResult);
      totalDuration = chunkResult.endTime;

      console.log(`Chunk ${i + 1} completed: ${chunkResult.text.substring(0, 100)}...`);

      // Small delay to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      throw new Error(`Failed to process chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Stitch chunks together
  console.log('Stitching chunks together');
  const stitchedResult = stitchTranscriptionChunks(transcriptionChunks, fileName, totalDuration);

  // Update final status
  await supabase
    .from('audio_uploads')
    .update({ 
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString()
    })
    .eq('upload_id', uploadId);

  return new Response(
    JSON.stringify(stitchedResult),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Create file chunks (simple byte-based chunking)
async function createFileChunks(file: Blob, maxChunkSize: number): Promise<Blob[]> {
  const chunks: Blob[] = [];
  const fileSize = file.size;
  let offset = 0;

  while (offset < fileSize) {
    const chunkSize = Math.min(maxChunkSize, fileSize - offset);
    const chunk = file.slice(offset, offset + chunkSize);
    chunks.push(chunk);
    offset += chunkSize;
  }

  return chunks;
}

// Stitch transcription chunks together
function stitchTranscriptionChunks(chunks: TranscriptionChunk[], fileName: string, totalDuration: number) {
  const allSegments = chunks.flatMap(chunk => chunk.segments);
  
  // Create speakers (for now, single speaker)
  const speakers = [{
    id: 'Speaker_1',
    segments: allSegments
  }];

  return {
    speakers,
    meetingDate: new Date().toLocaleDateString(),
    meetingTitle: fileName.replace(/\.[^/.]+$/, "") + " (Chunked Transcription)",
    duration: formatDuration(totalDuration),
    wordCount: allSegments.reduce((count, segment) => count + segment.text.split(' ').length, 0)
  };
}

// Format single transcription response
function formatTranscriptionResponse(transcriptionData: any, fileName: string) {
  const segments = transcriptionData.segments?.map((segment: any) => ({
    text: segment.text.trim(),
    timestamp: formatTimestamp(segment.start),
    duration: segment.end - segment.start,
  })) || [];

  const speakers = [{
    id: 'Speaker_1',
    segments: segments
  }];

  return new Response(
    JSON.stringify({
      speakers,
      meetingDate: new Date().toLocaleDateString(),
      meetingTitle: fileName.replace(/\.[^/.]+$/, "") + " (Direct Transcription)",
      duration: formatDuration(transcriptionData.duration || 0),
      wordCount: segments.reduce((count: number, segment: any) => count + segment.text.split(' ').length, 0)
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Utility functions
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}