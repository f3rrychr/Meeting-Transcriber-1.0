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

// Standard response format
interface ApiResponse<T = any> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
}

interface UploadResponse {
  uploadId: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
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
    message: 'Upload completed successfully',
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

    console.log("Upload function received request:", {
      hasFile: !!audioFile,
      fileName: audioFile?.name,
      fileSize: audioFile?.size,
      hasApiKey: !!apiKey,
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

    // Generate unique upload ID
    const uploadId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = audioFile.name.split('.').pop() || 'audio';
    const storagePath = `audio-uploads/${timestamp}-${uploadId}.${fileExtension}`;

    console.log(`Uploading file to storage: ${storagePath}`);

    // Upload file to Supabase Storage
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Convert File to ArrayBuffer for storage upload
    const fileBuffer = await audioFile.arrayBuffer();
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, fileBuffer, {
        contentType: audioFile.type || 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return createErrorResponse('STORAGE_ERROR', `Failed to upload file to storage: ${uploadError.message}`);
    }

    console.log('File uploaded to storage successfully:', uploadData.path);

    // Store upload metadata in database for tracking
    const { error: dbError } = await supabase
      .from('audio_uploads')
      .insert({
        upload_id: uploadId,
        storage_path: storagePath,
        file_name: audioFile.name,
        file_size: audioFile.size,
        content_type: audioFile.type,
        api_key_hash: await hashApiKey(apiKey), // Store hash for security
        status: 'uploaded',
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.warn('Failed to store upload metadata:', dbError);
      // Continue anyway, storage upload succeeded
    }

    const response: UploadResponse = {
      uploadId,
      storagePath,
      fileSize: audioFile.size,
      fileName: audioFile.name
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error("Upload function error:", error);
    
    return createErrorResponse(
      'SERVER_ERROR',
      error instanceof Error ? error.message : 'Unknown server error'
    );
  }
});

// Hash API key for secure storage (don't store raw keys)
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}