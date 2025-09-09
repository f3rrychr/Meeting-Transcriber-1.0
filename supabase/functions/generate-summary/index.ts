const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    message: 'Summary generated successfully',
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

    const { transcript, apiKey } = await req.json();

    console.log("Edge function received summary request:", {
      hasTranscript: !!transcript,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 3)
    });

    if (!transcript) {
      return createErrorResponse('NO_TRANSCRIPT', 'No transcript data provided', 400);
    }

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return createErrorResponse('INVALID_API_KEY', "Invalid OpenAI API key. Key should start with 'sk-'", 401);
    }

    console.log("Generating summary for transcript...");

    // Prepare transcript text for GPT
    const transcriptText = transcript.speakers.map((speaker: any) => 
      speaker.segments.map((segment: any) => `${speaker.id}: ${segment.text}`).join('\n')
    ).join('\n\n');

    if (transcriptText.length === 0) {
      return createErrorResponse('EMPTY_TRANSCRIPT', 'Empty transcript - cannot generate summary', 400);
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
      
      return createErrorResponse(
        'OPENAI_API_ERROR',
        errorData.error?.message || "OpenAI API error occurred",
        openaiResponse.status
      );
    }

    const gptData = await openaiResponse.json();
    const summaryText = gptData.choices[0]?.message?.content;

    if (!summaryText) {
      return createErrorResponse('NO_SUMMARY_GENERATED', 'No summary generated from OpenAI API');
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

    return createSuccessResponse(summaryData);

  } catch (error) {
    console.error("Edge function error:", error);
    
    return createErrorResponse(
      'SERVER_ERROR',
      error instanceof Error ? error.message : 'Unknown server error'
    );
  }
});