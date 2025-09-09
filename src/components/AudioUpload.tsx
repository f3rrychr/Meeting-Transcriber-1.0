import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, AlertCircle, Mic } from 'lucide-react';
import { validateAudioFile, getSupportedFormats, getFileAcceptString } from '../utils/fileValidation';
import AudioRecorder from './AudioRecorder';

// Get limits from environment variables with fallbacks
const getFileSizeLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_FILE_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

const getDurationLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_DURATION_MINUTES;
  return envLimit ? parseInt(envLimit) : 180; // Default 180 minutes (3 hours)
};

interface AudioUploadProps {
  onFileUpload: (file: File) => void;
}

const AudioUpload: React.FC<AudioUploadProps> = ({ onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<{
    detectedType?: string;
    remediationTip?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');

  const supportedFormats = getSupportedFormats();
  const fileAcceptString = getFileAcceptString();

  const handleFile = async (file: File) => {
    setError(null);
    setValidationDetails(null);
    
    const validation = await validateAudioFile(file);
    
    if (!validation.isValid) {
      setError(validation.error || 'File validation failed');
      setValidationDetails({
        detectedType: validation.detectedType,
        remediationTip: validation.remediationTip
      });
      return;
    }
    
    // Show detected format for user confirmation
    if (validation.detectedType) {
      setValidationDetails({
        detectedType: validation.detectedType
      });
    }
    
    onFileUpload(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-0">

      {/* Content based on active tab */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side - Recording */}
        <div>
          <AudioRecorder onRecordingComplete={onFileUpload} />
        </div>

        {/* Right Side - File Upload */}
        <div>
          <div className="max-w-md w-full mx-auto">
            <div
              className={`
                border-2 border-dashed rounded-xl p-6 sm:p-8 text-center h-[400px] flex flex-col justify-center transition-all duration-200
                ${isDragOver 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileAudio className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
                Upload Meeting Audio
              </h2>
              
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                Drag and drop your audio file here, or click to browse
              </p>
              
              <div className="space-y-4 flex-shrink-0">
                <label className="inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm w-48">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Audio File
                  <input
                    type="file"
                    className="hidden"
                    accept={fileAcceptString}
                    onChange={handleFileSelect}
                  />
                </label>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Supported formats: {supportedFormats.join(', ')}</p>
                  <p>Maximum size: {Math.round(getFileSizeLimit() / 1024 / 1024)}MB (≈{Math.round(getDurationLimit() / 60)} hours)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Upload Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
              
              {validationDetails?.detectedType && (
                <p className="text-red-600 mt-2 text-sm">
                  <strong>Detected format:</strong> {validationDetails.detectedType}
                </p>
              )}
              
              {validationDetails?.remediationTip && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-blue-800 text-sm">
                    <strong>💡 Solution:</strong> {validationDetails.remediationTip}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {!error && validationDetails?.detectedType && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
              <span className="text-white text-xs">✓</span>
            </div>
            <div>
              <h3 className="font-medium text-green-800">File Validated</h3>
              <p className="text-green-700 mt-1">
                Detected format: <strong>{validationDetails.detectedType}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioUpload;