// Get allowed origins from environment variable, fallback to wildcard
const getAllowedOrigins = (): string => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  return allowedOrigins || '*';
};

const getCorsHeaders = () => ({
  "Access-Control-Allow-Origin": getAllowedOrigins(),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400", // 24 hours
});

interface StreamingTranscribeRequest {
  uploadId: string;
  storagePath: string;
  apiKey: string;
  chunkSize?: number;
  maxChunkSize?: number;
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

interface StreamEvent {
  type: 'progress' | 'chunk' | 'complete' | 'error';
  data: any;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders();
  
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
          headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const requestData: StreamingTranscribeRequest = await req.json();
    const { uploadId, storagePath, apiKey, chunkSize = 300, maxChunkSize = 25 * 1024 * 1024 } = requestData;

    console.log("Streaming transcribe function received request:", {
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
          headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
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
          headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await processTranscriptionWithStreaming(
            uploadId,
            storagePath,
            apiKey,
            chunkSize,
            maxChunkSize,
            controller
          );
        } catch (error) {
          console.error("Streaming transcription error:", error);
          sendSSEEvent(controller, {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              statusCode: 500,
              apiType: 'supabase'
            }
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Streaming transcribe function error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown server error',
        statusCode: 500,
        apiType: "supabase"
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});

async function processTranscriptionWithStreaming(
  uploadId: string,
  storagePath: string,
  apiKey: string,
  chunkDurationSeconds: number,
  maxChunkSize: number,
  controller: ReadableStreamDefaultController
) {
  // Initialize Supabase client
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Send initial progress
  sendSSEEvent(controller, {
    type: 'progress',
    data: {
      phase: 'processing',
      percentage: 0,
      message: 'Downloading file from storage...',
      isIndeterminate: true
    }
  });

  // Download file from storage
  console.log(`Downloading file from storage: ${storagePath}`);
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('audio-files')
    .download(storagePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download file from storage: ${downloadError?.message || 'File not found'}`);
  }

  const fileSize = fileData.size;
  console.log(`Downloaded file size: ${Math.round(fileSize / 1024 / 1024)}MB`);

  // Send progress update
  sendSSEEvent(controller, {
    type: 'progress',
    data: {
      phase: 'processing',
      percentage: 10,
      message: 'File downloaded, preparing for transcription...',
      isIndeterminate: false
    }
  });

  // Check if file needs chunking
  if (fileSize <= maxChunkSize) {
    console.log('File is small enough for direct transcription');
    await transcribeDirectlyWithStreaming(fileData, apiKey, storagePath, controller);
  } else {
    console.log('File is large, using chunked transcription');
    await transcribeInChunksWithStreaming(
      fileData, 
      apiKey, 
      storagePath, 
      chunkDurationSeconds, 
      maxChunkSize, 
      supabase, 
      uploadId, 
      controller
    );
  }
}

async function transcribeDirectlyWithStreaming(
  fileData: Blob, 
  apiKey: string, 
  fileName: string,
  controller: ReadableStreamDefaultController
) {
  console.log('Starting direct transcription with streaming');
  
  sendSSEEvent(controller, {
    type: 'progress',
    data: {
      phase: 'transcription',
      percentage: 20,
      message: 'Sending to OpenAI Whisper...',
      isIndeterminate: false
    }
  });
  
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

  sendSSEEvent(controller, {
    type: 'progress',
    data: {
      phase: 'transcription',
      percentage: 80,
      message: 'Processing transcription response...',
      isIndeterminate: false
    }
  });

  const transcriptionData = await openaiResponse.json();
  
  // Stream segments as they're processed
  const segments = transcriptionData.segments || [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    sendSSEEvent(controller, {
      type: 'chunk',
      data: {
        chunkIndex: 0,
        segmentIndex: i,
        totalSegments: segments.length,
        segment: {
          text: segment.text.trim(),
          timestamp: formatTimestamp(segment.start),
          duration: segment.end - segment.start,
        },
        progress: Math.round(((i + 1) / segments.length) * 100)
      }
    });
    
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Send final result
  const finalResult = formatTranscriptionResponse(transcriptionData, fileName);
  sendSSEEvent(controller, {
    type: 'complete',
    data: finalResult
  });
}

async function transcribeInChunksWithStreaming(
  fileData: Blob, 
  apiKey: string, 
  fileName: string, 
  chunkDurationSeconds: number,
  maxChunkSize: number,
  supabase: any,
  uploadId: string,
  controller: ReadableStreamDefaultController
) {
  console.log(`Starting chunked transcription with streaming`);
  
  // Create file chunks
  const chunks = await createFileChunks(fileData, maxChunkSize);
  console.log(`Created ${chunks.length} chunks`);

  sendSSEEvent(controller, {
    type: 'progress',
    data: {
      phase: 'transcription',
      percentage: 0,
      message: `Processing ${chunks.length} chunks...`,
      chunksReceived: 0,
      totalChunks: chunks.length
    }
  });

  const transcriptionChunks: TranscriptionChunk[] = [];
  let totalDuration = 0;

  // Process chunks sequentially with streaming updates
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

      // Send progress update
      sendSSEEvent(controller, {
        type: 'progress',
        data: {
          phase: 'transcription',
          percentage: Math.round((i / chunks.length) * 80),
          message: `Transcribing chunk ${i + 1}/${chunks.length}...`,
          chunksReceived: i,
          totalChunks: chunks.length
        }
      });

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

      // Stream chunk result immediately
      sendSSEEvent(controller, {
        type: 'chunk',
        data: {
          chunkIndex: i,
          totalChunks: chunks.length,
          chunk: chunkResult,
          progress: Math.round(((i + 1) / chunks.length) * 100)
        }
      });

      console.log(`Chunk ${i + 1} completed: ${chunkResult.text.substring(0, 100)}...`);

      // Small delay to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      sendSSEEvent(controller, {
        type: 'error',
        data: {
          error: `Failed to process chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          chunkIndex: i,
          statusCode: 500,
          apiType: 'openai'
        }
      });
      throw error;
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

  // Send final complete result
  sendSSEEvent(controller, {
    type: 'complete',
    data: stitchedResult
  });
}

// Helper function to send SSE events
function sendSSEEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
  const eventData = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(eventData));
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
    meetingTitle: fileName.replace(/\.[^/.]+$/, "") + " (Streaming Transcription)",
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

  return {
    speakers,
    meetingDate: new Date().toLocaleDateString(),
    meetingTitle: fileName.replace(/\.[^/.]+$/, "") + " (Direct Transcription)",
    duration: formatDuration(transcriptionData.duration || 0),
    wordCount: segments.reduce((count: number, segment: any) => count + segment.text.split(' ').length, 0)
  };
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