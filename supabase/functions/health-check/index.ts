// Health check edge function for testing Supabase connectivity
const getCorsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400", // 24 hours
});

interface HealthCheckResponse {
  status: 'healthy';
  timestamp: string;
  environment: {
    supabaseUrl: string;
    hasAnonKey: boolean;
    hasServiceKey: boolean;
  };
  services: {
    database: 'available' | 'unavailable';
    storage: 'available' | 'unavailable';
  };
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
    // Basic environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const hasAnonKey = !!Deno.env.get('SUPABASE_ANON_KEY');
    const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Test database connectivity if possible
    let databaseStatus: 'available' | 'unavailable' = 'unavailable';
    let storageStatus: 'available' | 'unavailable' = 'unavailable';

    try {
      if (hasServiceKey) {
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const supabase = createClient(
          supabaseUrl,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Test database
        const { error: dbError } = await supabase
          .from('audio_uploads')
          .select('count')
          .limit(1);
        
        databaseStatus = dbError ? 'unavailable' : 'available';

        // Test storage
        const { error: storageError } = await supabase.storage
          .from('audio-files')
          .list('', { limit: 1 });
        
        storageStatus = storageError ? 'unavailable' : 'available';
      }
    } catch (error) {
      console.warn('Service connectivity test failed:', error);
    }

    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrl,
        hasAnonKey,
        hasServiceKey,
      },
      services: {
        database: databaseStatus,
        storage: storageStatus,
      },
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Health check error:", error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});