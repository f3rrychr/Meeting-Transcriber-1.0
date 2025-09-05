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

    const { transcript, apiKey } = await req.json();

    console.log("Edge function received summary request:", {
      hasTranscript: !!transcript,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 3)
    });

    if (!transcript) {
      return new Response(
        JSON.stringify({ 
          error: "No transcript data provided",
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

    console.log("Generating summary for transcript...");

    // Prepare transcript text for GPT
    const transcriptText = transcript.speakers.map((speaker: any) => 
      speaker.segments.map((segment: any) => `${speaker.id}: ${segment.text}`).join('\n')
    ).join('\n\n');

    if (transcriptText.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Empty transcript - cannot generate summary",
          statusCode: 400,
          apiType: "supabase"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = `Please analyze the following meeting transcript and provide a structured summary in JSON format with the following structure:

{
  "keyPoints": ["point1", "point2", ...],
  "actionItems": [
    {
      "task": "task description",
      "assignee": "person responsible",
      "dueDate": "YYYY-MM-DD",
      "remarks": "optional remarks"
    }
  ],
  "risks": [
    {
      "type": "Risk" or "Issue",
      "category": "category name",
      "item": "description",
      "remarks": "optional remarks"
    }
  ],
  "nextMeetingPlan": {
    "meetingName": "name",
    "scheduledDate": "YYYY-MM-DD",
    "scheduledTime": "HH:MM AM/PM",
    "agenda": "agenda description"
  },
  "meetingContext": {
    "meetingName": "${transcript.meetingTitle}",
    "meetingDate": "${transcript.meetingDate}",
    "participants": ["participant1", "participant2", ...]
  }
}

Transcript:
${transcriptText}`;

    console.log("Sending summary request to OpenAI GPT...");

    // Call OpenAI GPT API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert meeting analyst. Analyze meeting transcripts and provide structured summaries in the exact JSON format requested."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    console.log("OpenAI GPT API response status:", openaiResponse.status);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error("OpenAI GPT API error:", errorData);
      
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

    const gptData = await openaiResponse.json();
    const summaryText = gptData.choices[0]?.message?.content;

    if (!summaryText) {
      return new Response(
        JSON.stringify({ 
          error: "No summary generated from OpenAI API",
          statusCode: 500,
          apiType: "openai"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Summary generated successfully");

    // Parse JSON response
    let summaryData;
    try {
      // Clean the response text to handle potential formatting issues
      const cleanedText = summaryText.trim();
      
      // Try to extract JSON if it's wrapped in markdown code blocks
      let jsonText = cleanedText;
      if (cleanedText.includes('```json')) {
        const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      } else if (cleanedText.includes('```')) {
        const jsonMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      }
      
      summaryData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse summary JSON:", summaryText);
      
      // Return a fallback summary structure
      summaryData = {
        keyPoints: [summaryText.substring(0, 500) + '...'],
        actionItems: [],
        risks: [],
        nextMeetingPlan: {
          meetingName: "Follow-up Meeting",
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          scheduledTime: "10:00 AM",
          agenda: "Review previous meeting outcomes"
        },
        meetingContext: {
          meetingName: transcript.meetingTitle,
          meetingDate: transcript.meetingDate,
          participants: transcript.speakers.map((s: any) => s.id)
        }
      };
    }

    return new Response(
      JSON.stringify(summaryData),
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