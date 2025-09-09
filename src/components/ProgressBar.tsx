import React from 'react';
import { ProgressState } from '../types';
import { CheckCircle, Clock, Upload, Zap, FileText, Brain, Save, AlertCircle } from 'lucide-react';

interface ProgressBarProps {
  progressState: ProgressState;
}

interface StageInfo {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}

const STAGES: StageInfo[] = [
  { 
    key: 'validating', 
    label: 'Validating', 
    icon: CheckCircle, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100',
    description: 'Checking file format and size'
  },
  { 
    key: 'compressing', 
    label: 'Compressing', 
    icon: Zap, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100',
    description: 'Optimizing audio for processing'
  },
  { 
    key: 'uploading', 
    label: 'Uploading', 
    icon: Upload, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-100',
    description: 'Transferring to secure storage'
  },
  { 
    key: 'transcribing', 
    label: 'Transcribing', 
    icon: FileText, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100',
    description: 'Converting speech to text'
  },
  { 
    key: 'summarizing', 
    label: 'Summarizing', 
    icon: Brain, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100',
    description: 'Generating AI summary'
  },
  { 
    key: 'saving', 
    label: 'Saving', 
    icon: Save, 
    color: 'text-teal-600', 
    bgColor: 'bg-teal-100',
    description: 'Storing results locally'
  },
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
    completedStages = [],
    totalStages = STAGES.length,
    currentStageIndex
  } = progressState;

  const currentStageIndexCalc = currentStageIndex ?? STAGES.findIndex(s => s.key === stage);
  const isComplete = stage === 'complete';

  // Calculate overall progress based on completed stages
  const calculateOverallProgress = () => {
    if (isComplete) return 100;
    
    const completedCount = completedStages.length;
    const stageWeight = 100 / totalStages;
    const baseProgress = completedCount * stageWeight;
    
    // Add progress from current stage
    const currentStageProgress = (stageProgress || 0) * (stageWeight / 100);
    
    return Math.min(100, Math.round(baseProgress + currentStageProgress));
  };

  const overallProgress = calculateOverallProgress();

  const getStageStatus = (stageIndex: number) => {
    const stageKey = STAGES[stageIndex].key;
    
    if (isComplete || completedStages.includes(stageKey)) {
      return 'completed';
    }
    if (stageIndex === currentStageIndexCalc) {
      return 'active';
    }
    if (stageIndex < currentStageIndexCalc) {
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
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold text-gray-800">
              {isComplete ? 'Processing Complete!' : `Processing Audio`}
            </span>
            {retryAttempt && (
              <span className="text-sm text-orange-600 font-medium">
                (Retry {retryAttempt}/4)
              </span>
            )}
          </div>
          <span className="text-lg font-semibold text-gray-800">
            {isIndeterminate && retryCountdown ? `${retryCountdown}s` : `${overallProgress}%`}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
          {isIndeterminate ? (
            <div className={`h-4 rounded-full bg-gradient-to-r ${
              retryAttempt ? 'from-orange-500 to-orange-600' : 'from-blue-500 to-blue-600'
            } animate-pulse`} />
          ) : (
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${Math.max(overallProgress, 2)}%` }}
            />
          )}
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">{message}</p>
          {retryCountdown && (
            <p className="text-sm text-orange-600 mt-1">
              ⏱️ Retrying in {retryCountdown} seconds...
            </p>
          )}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Processing Stages</h4>
          <span className="text-xs text-gray-500">
            {completedStages.length} of {totalStages} completed
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STAGES.map((stageInfo, index) => {
            const status = getStageStatus(index);
            const progress = getStageProgress(index);
            const Icon = stageInfo.icon;
            
            return (
              <div
                key={stageInfo.key}
                className={`relative p-4 rounded-lg border-2 transition-all duration-300 ${
                  status === 'completed' 
                    ? 'border-green-300 bg-green-50 shadow-sm' 
                    : status === 'active'
                    ? `border-gray-400 ${stageInfo.bgColor} shadow-md`
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`flex-shrink-0 ${
                    status === 'completed' 
                      ? 'text-green-600' 
                      : status === 'active'
                      ? stageInfo.color
                      : 'text-gray-400'
                  }`}>
                    {status === 'completed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className={`w-5 h-5 ${status === 'active' ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold block ${
                      status === 'completed' 
                        ? 'text-green-700' 
                        : status === 'active'
                        ? 'text-gray-800'
                        : 'text-gray-500'
                    }`}>
                      {stageInfo.label}
                    </span>
                    <span className={`text-xs block truncate ${
                      status === 'completed' 
                        ? 'text-green-600' 
                        : status === 'active'
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}>
                      {stageInfo.description}
                    </span>
                  </div>
                </div>
                
                {/* Stage progress bar */}
                {status === 'active' && !isIndeterminate && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stageInfo.color.replace('text-', 'bg-')
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-1 text-right">
                      {progress}%
                    </div>
                  </div>
                )}
                
                {/* Completion checkmark overlay */}
                {status === 'completed' && (
                  <div className="absolute -top-2 -right-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                
                {/* Active stage indicator */}
                {status === 'active' && (
                  <div className="absolute -top-1 -right-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Status */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="font-medium text-gray-800">Status Details</div>
        
        {bytesUploaded !== undefined && totalBytes !== undefined && (
          <div className="flex justify-between text-gray-600">
            <span>Upload Progress:</span>
            <span>{formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}</span>
          </div>
        )}
        
        {chunksReceived !== undefined && totalChunks !== undefined && totalChunks > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Chunks Processed:</span>
            <span>{chunksReceived} / {totalChunks}</span>
          </div>
        )}
        
        {!isComplete && (
          <div className="text-xs text-gray-500 mt-2">
            This process may take several minutes depending on file size and complexity.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;