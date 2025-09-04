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

    const { transcript, apiKey } = await req.json()

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "No transcript data provided" }),
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

    console.log("Generating summary for transcript...")

    // Prepare transcript text for GPT
    const transcriptText = transcript.speakers.map((speaker: any) => 
      speaker.segments.map((segment: any) => `${speaker.id}: ${segment.text}`).join('\n')
    ).join('\n\n')

    if (transcriptText.length === 0) {
      return new Response(
        JSON.stringify({ error: "Empty transcript - cannot generate summary" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
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
${transcriptText}`

    console.log("Sending summary request to OpenAI GPT...")

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
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error("OpenAI GPT API error:", errorData)
      
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

    const gptData = await openaiResponse.json()
    const summaryText = gptData.choices[0]?.message?.content

    if (!summaryText) {
      return new Response(
        JSON.stringify({ error: "No summary generated from OpenAI API" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Summary generated successfully")

    // Parse JSON response
    let summaryData
    try {
      // Clean the response text to handle potential formatting issues
      const cleanedText = summaryText.trim()
      
      // Try to extract JSON if it's wrapped in markdown code blocks
      let jsonText = cleanedText
      if (cleanedText.includes('```json')) {
        const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim()
        }
      } else if (cleanedText.includes('```')) {
        const jsonMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim()
        }
      }
      
      summaryData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error("Failed to parse summary JSON:", summaryText)
      
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
      }
    }

    return new Response(
      JSON.stringify(summaryData),
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