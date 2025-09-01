import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
import jsPDF from 'jspdf';
import { TranscriptData, SummaryData } from '../types';

export const exportTranscriptAsDocx = async (transcript: TranscriptData, fileName: string, includeTimestamps: boolean = true) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Meeting Transcript",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: "",
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Meeting: ", bold: true }),
            new TextRun({ text: transcript.meetingTitle }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Date: ", bold: true }),
            new TextRun({ text: transcript.meetingDate }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Duration: ", bold: true }),
            new TextRun({ text: transcript.duration }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Word Count: ", bold: true }),
            new TextRun({ text: transcript.wordCount.toString() }),
          ],
        }),
        new Paragraph({
          text: "",
        }),
        new Paragraph({
          text: "Transcript:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: "",
        }),
        ...transcript.speakers.flatMap(speaker => [
          new Paragraph({
            children: [
              new TextRun({ text: speaker.id, bold: true, size: 24 }),
            ],
          }),
          ...speaker.segments.map(segment => 
            new Paragraph({
              children: [
                ...(includeTimestamps ? [
                  new TextRun({ text: `[${segment.timestamp}] `, color: "666666", size: 20 }),
                ] : []),
                new TextRun({ text: segment.text }),
              ],
            })
          ),
          new Paragraph({ text: "" }),
        ]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_transcript.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportSummaryAsDocx = async (summary: SummaryData, fileName: string) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Meeting Summary",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        
        // Meeting Context
        new Paragraph({
          text: "Meeting Context",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Meeting: ", bold: true }),
            new TextRun({ text: summary.meetingContext.meetingName }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Date: ", bold: true }),
            new TextRun({ text: summary.meetingContext.meetingDate }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Participants: ", bold: true }),
            new TextRun({ text: summary.meetingContext.participants.join(', ') }),
          ],
        }),
        new Paragraph({ text: "" }),

        // Key Points
        new Paragraph({
          text: "Key Points",
          heading: HeadingLevel.HEADING_2,
        }),
        ...summary.keyPoints.map((point, index) => 
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. `, bold: true }),
              new TextRun({ text: point }),
            ],
          })
        ),
        new Paragraph({ text: "" }),

        // Action Items
        new Paragraph({
          text: "Action Items",
          heading: HeadingLevel.HEADING_2,
        }),
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })] })],
                  width: { size: 10, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Action Item", bold: true })] })],
                  width: { size: 40, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "PIC", bold: true })] })],
                  width: { size: 20, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Due Date", bold: true })] })],
                  width: { size: 15, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Remarks", bold: true })] })],
                  width: { size: 15, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...summary.actionItems.map((item, index) => 
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: (index + 1).toString() })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: item.task })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: item.assignee })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: item.dueDate })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: item.remarks || '-' })] })],
                  }),
                ],
              })
            ),
          ],
        }),
        new Paragraph({ text: "" }),

        // Risks & Issues
        new Paragraph({
          text: "Risks & Issues",
          heading: HeadingLevel.HEADING_2,
        }),
        ...summary.risks.map((risk, index) => [
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. `, bold: true }),
              new TextRun({ text: `[${risk.type}] `, bold: true, color: risk.type === 'Risk' ? 'FF8C00' : 'DC143C' }),
              new TextRun({ text: `${risk.category}: `, bold: true }),
              new TextRun({ text: risk.item }),
            ],
          }),
          ...(risk.remarks ? [
            new Paragraph({
              children: [
                new TextRun({ text: "   Remarks: ", bold: true }),
                new TextRun({ text: risk.remarks }),
              ],
            })
          ] : []),
          new Paragraph({ text: "" }),
        ]).flat(),

        // Next Meeting Plan
        new Paragraph({
          text: "Next Meeting Plan",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Meeting: ", bold: true }),
            new TextRun({ text: summary.nextMeetingPlan.meetingName }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Date & Time: ", bold: true }),
            new TextRun({ text: `${summary.nextMeetingPlan.scheduledDate} at ${summary.nextMeetingPlan.scheduledTime}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Agenda: ", bold: true }),
            new TextRun({ text: summary.nextMeetingPlan.agenda }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_summary.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportTranscriptAsPdf = (transcript: TranscriptData, fileName: string, includeTimestamps: boolean = true) => {
  const pdf = new jsPDF();
  const pageHeight = pdf.internal.pageSize.height;
  let yPosition = 20;
  
  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Meeting Transcript', 105, yPosition, { align: 'center' });
  yPosition += 15;
  
  // Metadata
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Meeting: ${transcript.meetingTitle}`, 20, yPosition);
  yPosition += 8;
  pdf.text(`Date: ${transcript.meetingDate}`, 20, yPosition);
  yPosition += 8;
  pdf.text(`Duration: ${transcript.duration}`, 20, yPosition);
  yPosition += 8;
  pdf.text(`Word Count: ${transcript.wordCount}`, 20, yPosition);
  yPosition += 15;
  
  // Transcript content
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Transcript:', 20, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(10);
  
  transcript.speakers.forEach(speaker => {
    // Check if we need a new page
    if (yPosition > pageHeight - 30) {
      pdf.addPage();
      yPosition = 20;
    }
    
    // Speaker name
    pdf.setFont('helvetica', 'bold');
    pdf.text(speaker.id, 20, yPosition);
    yPosition += 8;
    
    speaker.segments.forEach(segment => {
      pdf.setFont('helvetica', 'normal');
      
      const text = includeTimestamps ? `[${segment.timestamp}] ${segment.text}` : segment.text;
      const lines = pdf.splitTextToSize(text, 170);
      
      // Check if we need a new page for this segment
      if (yPosition + (lines.length * 5) > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      
      lines.forEach((line: string) => {
        pdf.text(line, 25, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    });
    yPosition += 5;
  });
  
  pdf.save(`${fileName}_transcript.pdf`);
};

export const exportSummaryAsPdf = (summary: SummaryData, fileName: string) => {
  const pdf = new jsPDF();
  const pageHeight = pdf.internal.pageSize.height;
  let yPosition = 20;
  
  const addSection = (title: string, content: string[]) => {
    // Check if we need a new page for the section title
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 20, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    content.forEach(item => {
      const lines = pdf.splitTextToSize(item, 170);
      
      // Check if we need a new page for this content
      if (yPosition + (lines.length * 5) > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      
      lines.forEach((line: string) => {
        pdf.text(line, 25, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    });
    yPosition += 8;
  };
  
  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Meeting Summary', 105, yPosition, { align: 'center' });
  yPosition += 20;
  
  // Meeting Context
  const contextContent = [
    `Meeting: ${summary.meetingContext.meetingName}`,
    `Date: ${summary.meetingContext.meetingDate}`,
    `Participants: ${summary.meetingContext.participants.join(', ')}`
  ];
  addSection('Meeting Context', contextContent);
  
  // Key Points
  const keyPointsContent = summary.keyPoints.map((point, index) => `${index + 1}. ${point}`);
  addSection('Key Points', keyPointsContent);
  
  // Action Items
  const actionItemsContent = summary.actionItems.map((item, index) => {
    return [
      (index + 1).toString(),
      item.task,
      item.assignee,
      item.dueDate,
      item.remarks || '-'
    ];
  });
  
  // Add Action Items as table
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = 20;
  }
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Action Items', 20, yPosition);
  yPosition += 15;
  
  // Table headers
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  const colWidths = [15, 70, 40, 30, 35]; // Column widths
  const colPositions = [20, 35, 105, 145, 175]; // X positions
  
  pdf.text('No', colPositions[0], yPosition);
  pdf.text('Action Item', colPositions[1], yPosition);
  pdf.text('PIC', colPositions[2], yPosition);
  pdf.text('Due Date', colPositions[3], yPosition);
  pdf.text('Remarks', colPositions[4], yPosition);
  yPosition += 8;
  
  // Draw header line
  pdf.line(20, yPosition - 2, 200, yPosition - 2);
  yPosition += 3;
  
  // Table rows
  pdf.setFont('helvetica', 'normal');
  summary.actionItems.forEach((item, index) => {
    if (yPosition > pageHeight - 30) {
      pdf.addPage();
      yPosition = 20;
    }
    
    // Split long text for wrapping
    const taskLines = pdf.splitTextToSize(item.task, colWidths[1] - 5);
    const remarksLines = pdf.splitTextToSize(item.remarks || '-', colWidths[4] - 5);
    const maxLines = Math.max(taskLines.length, remarksLines.length, 1);
    
    // Row data
    pdf.text((index + 1).toString(), colPositions[0], yPosition);
    pdf.text(item.assignee, colPositions[2], yPosition);
    pdf.text(item.dueDate, colPositions[3], yPosition);
    
    // Multi-line content
    taskLines.forEach((line: string, lineIndex: number) => {
      pdf.text(line, colPositions[1], yPosition + (lineIndex * 4));
    });
    
    remarksLines.forEach((line: string, lineIndex: number) => {
      pdf.text(line, colPositions[4], yPosition + (lineIndex * 4));
    });
    
    yPosition += maxLines * 4 + 3;
  });
  
  yPosition += 8;
  
  // Risks & Issues
  const risksContent = summary.risks.map((risk, index) => {
    let text = `${index + 1}. [${risk.type}] ${risk.category}: ${risk.item}`;
    if (risk.remarks) {
      text += ` | Remarks: ${risk.remarks}`;
    }
    return text;
  });
  addSection('Risks & Issues', risksContent);
  
  // Next Meeting Plan
  const nextMeetingContent = [
    `Meeting: ${summary.nextMeetingPlan.meetingName}`,
    `Date & Time: ${summary.nextMeetingPlan.scheduledDate} at ${summary.nextMeetingPlan.scheduledTime}`,
    `Agenda: ${summary.nextMeetingPlan.agenda}`
  ];
  addSection('Next Meeting Plan', nextMeetingContent);
  
  pdf.save(`${fileName}_summary.pdf`);
};