import React from 'react';
import { ProgressState } from '../types';
import { CheckCircle, Clock, Upload, Zap, FileText, Brain, Save } from 'lucide-react';

interface ProgressBarProps {
  progressState: ProgressState;
}

interface StageInfo {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const STAGES: StageInfo[] = [
  { key: 'validating', label: 'Validating', icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { key: 'compressing', label: 'Compressing', icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { key: 'uploading', label: 'Uploading', icon: Upload, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { key: 'transcribing', label: 'Transcribing', icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100' },
  { key: 'summarizing', label: 'Summarizing', icon: Brain, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { key: 'saving', label: 'Saving', icon: Save, color: 'text-teal-600', bgColor: 'bg-teal-100' },
];

const ProgressBar: React.FC<ProgressBarProps> = ({ progressState }) => {
  const { 
    stage, 
    percentage, 
    message, 
    isIndeterminate = false,
    bytesUploaded, 
    totalBytes, 
    chunksReceived, 
    totalChunks,
    retryAttempt,
    retryCountdown,
    stageProgress,
    completedStages = []
  } = progressState;

  const currentStageIndex = STAGES.findIndex(s => s.key === stage);
  const isComplete = stage === 'complete';

  const getStageStatus = (stageIndex: number) => {
    if (isComplete || completedStages.includes(STAGES[stageIndex].key)) {
      return 'completed';
    }
    if (stageIndex === currentStageIndex) {
      return 'active';
    }
    if (stageIndex < currentStageIndex) {
      return 'completed';
    }
    return 'pending';
  };

  const getStageProgress = (stageIndex: number) => {
    const status = getStageStatus(stageIndex);
    if (status === 'completed') return 100;
    if (status === 'active') return stageProgress || 0;
    return 0;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            {isComplete ? 'Complete' : `${stage.charAt(0).toUpperCase() + stage.slice(1)}`}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {isIndeterminate ? (retryCountdown ? `${retryCountdown}s` : '...') : `${percentage}%`}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          {isIndeterminate ? (
            <div className={`h-3 rounded-full bg-gradient-to-r ${
              retryAttempt ? 'from-orange-500 to-orange-600' : 'from-blue-500 to-blue-600'
            } ${retryCountdown ? 'animate-pulse' : 'animate-pulse'}`} />
          ) : (
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          )}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Processing Stages</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STAGES.map((stageInfo, index) => {
            const status = getStageStatus(index);
            const progress = getStageProgress(index);
            const Icon = stageInfo.icon;
            
            return (
              <div
                key={stageInfo.key}
                className={`relative p-3 rounded-lg border transition-all duration-300 ${
                  status === 'completed' 
                    ? 'border-green-200 bg-green-50' 
                    : status === 'active'
                    ? `border-gray-300 ${stageInfo.bgColor}`
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`flex-shrink-0 ${
                    status === 'completed' 
                      ? 'text-green-600' 
                      : status === 'active'
                      ? stageInfo.color
                      : 'text-gray-400'
                  }`}>
                    {status === 'completed' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className={`w-4 h-4 ${status === 'active' ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    status === 'completed' 
                      ? 'text-green-700' 
                      : status === 'active'
                      ? 'text-gray-800'
                      : 'text-gray-500'
                  }`}>
                    {stageInfo.label}
                  </span>
                </div>
                
                {/* Stage progress bar */}
                {status === 'active' && !isIndeterminate && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-300 ${
                          stageInfo.color.replace('text-', 'bg-')
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Completion checkmark */}
                {status === 'completed' && (
                  <div className="absolute -top-1 -right-1">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Status */}
      <div className="space-y-2 text-xs text-gray-600">
        <div className="font-medium">{message}</div>
        
        {retryAttempt && !retryCountdown && (
          <div className="text-orange-600 font-medium">
            Retry attempt {retryAttempt}/4
          </div>
        )}
        
        {retryCountdown && (
          <div className="text-orange-600 font-medium">
            ⏱️ Retrying in {retryCountdown} seconds...
          </div>
        )}
        
        {bytesUploaded !== undefined && totalBytes !== undefined && (
          <div>
            {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)} uploaded
          </div>
        )}
        
        {chunksReceived !== undefined && totalChunks !== undefined && totalChunks > 0 && (
          <div>
            {chunksReceived} / {totalChunks} chunks processed
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;