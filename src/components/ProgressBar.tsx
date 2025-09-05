import React from 'react';
import { ProgressState } from '../types';

interface ProgressBarProps {
  progressState: ProgressState;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progressState }) => {
  const { phase, percentage, isIndeterminate, message, bytesUploaded, totalBytes, chunksReceived, totalChunks } = progressState;

  const getPhaseColor = () => {
    switch (phase) {
      case 'upload': return 'from-blue-500 to-blue-600';
      case 'processing': return 'from-yellow-500 to-yellow-600';
      case 'transcription': return 'from-green-500 to-green-600';
      case 'summary': return 'from-purple-500 to-purple-600';
      case 'complete': return 'from-green-500 to-green-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 capitalize">{phase}</span>
        <span className="text-sm font-medium text-gray-700">
          {isIndeterminate ? '...' : `${percentage}%`}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        {isIndeterminate ? (
          <div className={`h-3 rounded-full bg-gradient-to-r ${getPhaseColor()} animate-pulse`} />
        ) : (
          <div
            className={`bg-gradient-to-r ${getPhaseColor()} h-3 rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-600">
        <div>{message}</div>
        {bytesUploaded !== undefined && totalBytes !== undefined && (
          <div className="mt-1">
            {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)} uploaded
          </div>
        )}
        {chunksReceived !== undefined && totalChunks !== undefined && totalChunks > 0 && (
          <div className="mt-1">
            {chunksReceived} / {totalChunks} chunks processed
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;