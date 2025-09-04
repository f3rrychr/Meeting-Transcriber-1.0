// Mock API Service for testing transcription functionality without external APIs
import { TranscriptData, SummaryData, TranscriptSegment, Speaker } from '../types';

export const mockTranscribeAudio = async (file: File): Promise<TranscriptData> => {
  console.log('Using mock transcription for file:', file.name);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate mock transcript based on file name and duration
  const segments: TranscriptSegment[] = [
    {
      text: "Welcome everyone to today's meeting. Let's start by reviewing our agenda.",
      timestamp: "00:00",
      duration: 4.2
    },
    {
      text: "First item on our list is the quarterly budget review. Sarah, can you walk us through the numbers?",
      timestamp: "00:04",
      duration: 6.1
    },
    {
      text: "Absolutely. Our revenue is up 15% compared to last quarter, which is excellent news.",
      timestamp: "00:10",
      duration: 5.3
    },
    {
      text: "That's great to hear. What about our operational expenses? Are we staying within budget?",
      timestamp: "00:15",
      duration: 4.8
    },
    {
      text: "We're slightly over budget on marketing, but under budget on development costs. Overall, we're on track.",
      timestamp: "00:20",
      duration: 6.5
    },
    {
      text: "Perfect. Let's move on to the next agenda item. We need to discuss the upcoming product launch.",
      timestamp: "00:26",
      duration: 5.2
    },
    {
      text: "The development team has completed all major features. We're ready for beta testing next week.",
      timestamp: "00:31",
      duration: 5.8
    },
    {
      text: "Excellent work everyone. I'll coordinate with the QA team to ensure we have proper test coverage.",
      timestamp: "00:37",
      duration: 5.1
    }
  ];

  const speakers: Speaker[] = [
    {
      id: 'Speaker_1',
      segments: [segments[0], segments[1], segments[3], segments[5], segments[7]]
    },
    {
      id: 'Speaker_2', 
      segments: [segments[2], segments[4], segments[6]]
    }
  ];

  return {
    speakers,
    meetingDate: new Date().toLocaleDateString(),
    meetingTitle: file.name.replace(/\.[^/.]+$/, "") + " (Mock Transcription)",
    duration: "00:42",
    wordCount: segments.reduce((count, segment) => count + segment.text.split(' ').length, 0)
  };
};

export const mockGenerateSummary = async (transcript: TranscriptData): Promise<SummaryData> => {
  console.log('Using mock summary generation');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    keyPoints: [
      "Quarterly revenue increased by 15% compared to previous quarter",
      "Marketing expenses slightly over budget, development costs under budget",
      "Product launch development completed, ready for beta testing",
      "QA team coordination needed for proper test coverage"
    ],
    actionItems: [
      {
        task: "Coordinate with QA team for beta testing preparation",
        assignee: "Project Manager",
        dueDate: "2025-01-20",
        remarks: "Ensure comprehensive test coverage before launch"
      },
      {
        task: "Review marketing budget allocation for next quarter",
        assignee: "Sarah",
        dueDate: "2025-01-25",
        remarks: "Address budget overrun and optimize spending"
      },
      {
        task: "Finalize beta testing schedule and participant list",
        assignee: "Development Team",
        dueDate: "2025-01-18",
        remarks: "Target launch for next week"
      }
    ],
    risks: [
      {
        type: "Risk",
        category: "Budget",
        item: "Marketing expenses exceeding allocated budget",
        remarks: "Monitor spending closely to prevent further overruns"
      },
      {
        type: "Issue",
        category: "Timeline",
        item: "Tight timeline for beta testing preparation",
        remarks: "May need additional resources to meet launch deadline"
      }
    ],
    nextMeetingPlan: {
      meetingName: "Product Launch Review",
      scheduledDate: "2025-01-27",
      scheduledTime: "2:00 PM",
      agenda: "Review beta testing results and finalize launch strategy"
    },
    meetingContext: {
      meetingName: transcript.meetingTitle,
      meetingDate: transcript.meetingDate,
      participants: transcript.speakers.map(s => s.id)
    }
  };
};