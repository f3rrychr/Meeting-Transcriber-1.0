import React, { useState } from 'react';
import { Copy, Download, CheckSquare, AlertTriangle, CalendarDays, Lightbulb, Calendar, Users, FileText, Clock } from 'lucide-react';
import { SummaryData } from '../types';
import { exportSummaryAsDocx, exportSummaryAsPdf } from '../utils/exportUtils';

interface SummaryPanelProps {
  summary: SummaryData | null;
  isLoading: boolean;
  fileName: string;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ summary, isLoading, fileName }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportSummary = (format: 'txt' | 'docx' | 'pdf') => {
    if (!summary) return;
    
    const baseFileName = fileName.replace(/\.[^/.]+$/, "");
    
    if (format === 'docx') {
      exportSummaryAsDocx(summary, baseFileName);
    } else if (format === 'pdf') {
      exportSummaryAsPdf(summary, baseFileName);
    } else {
      // TXT format
      let content = `Meeting Summary\n\n`;
      
      content += `MEETING CONTEXT:\n`;
      content += `Meeting: ${summary.meetingContext.meetingName}\n`;
      content += `Date: ${summary.meetingContext.meetingDate}\n`;
      content += `Participants:\n`;
      summary.meetingContext.participants.forEach((participant, index) => {
        content += `${index + 1}. ${participant}\n`;
      });
      content += `\n`;
      
      content += `KEY POINTS:\n`;
      summary.keyPoints.forEach((point, index) => {
        content += `${index + 1}. ${point}\n`;
      });
      
      content += `\nACTION ITEMS:\n`;
      summary.actionItems.forEach((item, index) => {
        content += `${index + 1}. ${item.task} | PIC: ${item.assignee} | Due: ${item.dueDate}${item.remarks ? ` | Remarks: ${item.remarks}` : ''}\n`;
      });
      
      content += `\nRISKS & CONCERNS:\n`;
      summary.risks.forEach((risk, index) => {
        content += `${index + 1}. [${risk.type}] [${risk.category}] ${risk.item}${risk.remarks ? ` | Remarks: ${risk.remarks}` : ''}\n`;
      });
      
      content += `\nNEXT MEETING PLAN:\n`;
      content += `Meeting: ${summary.nextMeetingPlan.meetingName}\n`;
      content += `Date: ${summary.nextMeetingPlan.scheduledDate}\n`;
      content += `Time: ${summary.nextMeetingPlan.scheduledTime}\n`;
      content += `Agenda: ${summary.nextMeetingPlan.agenda}\n`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFileName}_summary.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getFullSummaryText = () => {
    if (!summary) return '';
    
    let fullText = 'MEETING SUMMARY\n\n';
    
    fullText += 'MEETING CONTEXT:\n';
    fullText += `Meeting: ${summary.meetingContext.meetingName}\n`;
    fullText += `Date: ${summary.meetingContext.meetingDate}\n`;
    fullText += `Participants:\n`;
    summary.meetingContext.participants.forEach((participant, index) => {
      fullText += `${index + 1}. ${participant}\n`;
    });
    fullText += '\n';
    
    fullText += 'KEY POINTS:\n';
    summary.keyPoints.forEach((point, index) => {
      fullText += `${index + 1}. ${point}\n`;
    });
    
    fullText += '\nACTION ITEMS:\n';
    summary.actionItems.forEach((item, index) => {
      fullText += `${index + 1}. ${item.task} | PIC: ${item.assignee} | Due: ${item.dueDate}${item.remarks ? ` | Remarks: ${item.remarks}` : ''}\n`;
    });
    
    fullText += '\nRISKS & CONCERNS:\n';
    summary.risks.forEach((risk, index) => {
      fullText += `${index + 1}. [${risk.type}] [${risk.category}] ${risk.item}${risk.remarks ? ` | Remarks: ${risk.remarks}` : ''}\n`;
    });
    
    fullText += '\nNEXT MEETING PLAN:\n';
    fullText += `Meeting: ${summary.nextMeetingPlan.meetingName}\n`;
    fullText += `Date: ${summary.nextMeetingPlan.scheduledDate}\n`;
    fullText += `Time: ${summary.nextMeetingPlan.scheduledTime}\n`;
    fullText += `Agenda: ${summary.nextMeetingPlan.agenda}\n`;
    
    return fullText;
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-blue-600" />
            Summary
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(getFullSummaryText())}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <div className="relative group">
              <button className="flex items-center px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={() => exportSummary('txt')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">TXT</button>
                <button onClick={() => exportSummary('docx')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">DOCX</button>
                <button onClick={() => exportSummary('pdf')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">PDF</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {summary ? (
          <div className="space-y-8">
            {/* Meeting Context */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                Meeting Context
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900">Meeting Name</h4>
                    <p className="text-gray-700">{summary.meetingContext.meetingName}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900">Date</h4>
                    <p className="text-gray-700">{summary.meetingContext.meetingDate}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Users className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">Participants</h4>
                    <div className="space-y-1">
                      {summary.meetingContext.participants.map((participant, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
                          <span className="text-gray-700 text-sm">{participant}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Key Points */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                Key Points
              </h3>
              <div className="space-y-3">
                {summary.keyPoints.map((point, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-gray-800 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Action Items */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckSquare className="w-5 h-5 mr-2 text-blue-600" />
                Action Items
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PIC
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {summary.actionItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {item.task}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                            {item.assignee}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {item.dueDate}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {item.remarks || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Risks */}
            {summary.risks.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
                  Risk & Issue
                </h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                            No
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {summary.risks.map((risk, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                risk.type === 'Risk' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {risk.type}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                risk.category === 'Resource' ? 'bg-red-100 text-red-800' :
                                risk.category === 'Technical' ? 'bg-orange-100 text-orange-800' :
                                risk.category === 'Timeline' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {risk.category}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              {risk.item}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {risk.remarks || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Next Steps */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2 text-purple-600" />
                Next Meeting Plan
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                <div className="space-y-3 text-gray-800">
                  <p><span className="font-medium">Meeting:</span> {summary.nextMeetingPlan.meetingName}</p>
                  <p><span className="font-medium">Date & Time:</span> {summary.nextMeetingPlan.scheduledDate} at {summary.nextMeetingPlan.scheduledTime}</p>
                  <p><span className="font-medium">Agenda:</span> {summary.nextMeetingPlan.agenda}</p>
                </div>
              </div>
            </section>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No summary available</p>
              <p className="text-sm mt-2">Upload an audio file to generate a summary</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPanel;