import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, AlertCircle, Mic } from 'lucide-react';
import { AudioProcessor } from '../utils/audioUtils';
import AudioRecorder from './AudioRecorder';

interface AudioUploadProps {
  onFileUpload: (file: File) => void;
}

const AudioUpload: React.FC<AudioUploadProps> = ({ onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');

  const validateFile = (file: File): string | null => {
    const maxSize = 250 * 1024 * 1024; // 250MB
    const supportedTypes = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'];
    
    if (file.size > maxSize) {
      return 'File size exceeds 250MB limit';
    }
    
    if (!supportedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|aac|m4a|ogg)$/i)) {
      return 'Unsupported file format. Please use MP3, WAV, AAC, M4A, or OGG files.';
    }
    
    return null;
  };

  const handleFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
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
      {/* Tab Navigation */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'record'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Mic className="w-4 h-4 mr-2" />
            Record Audio
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Recording */}
        <div className={`${activeTab === 'record' ? 'lg:block' : 'lg:block'}`}>
          <AudioRecorder onRecordingComplete={onFileUpload} />
        </div>

        {/* Right Side - File Upload */}
        <div className={`${activeTab === 'upload' ? 'lg:block' : 'lg:block'}`}>
          <div className="max-w-md w-full mx-auto">
            <div
              className={`
                border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-200
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
              
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Upload Meeting Audio
              </h2>
              
              <p className="text-sm text-gray-600 mb-6">
                Drag and drop your audio file here, or click to browse
              </p>
              
              <div className="space-y-4">
                <label className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Audio File
                  <input
                    type="file"
                    className="hidden"
                    accept=".mp3,.wav,.aac,.m4a,.ogg"
                    onChange={handleFileSelect}
                  />
                </label>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Supported formats: MP3, WAV, AAC, M4A, OGG</p>
                  <p>Maximum file size: 250MB (≈3 hours)</p>
                  <p className="text-amber-600">
                    <strong>Note:</strong> Files over 25MB will be automatically compressed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Tab Content */}
      <div className="lg:hidden">
        {activeTab === 'upload' && (
          <div className="mt-6">
            <div
              className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200
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
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Upload Meeting Audio
              </h2>
              
              <p className="text-sm text-gray-600 mb-6">
                Drag and drop your audio file here, or click to browse
              </p>
              
              <div className="space-y-4">
                <label className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Audio File
                  <input
                    type="file"
                    className="hidden"
                    accept=".mp3,.wav,.aac,.m4a,.ogg"
                    onChange={handleFileSelect}
                  />
                </label>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Supported formats: MP3, WAV, AAC, M4A, OGG</p>
                  <p>Maximum file size: 250MB (≈3 hours)</p>
                  <p className="text-amber-600">
                    <strong>Note:</strong> Files over 25MB will be automatically compressed
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800">Upload Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioUpload;