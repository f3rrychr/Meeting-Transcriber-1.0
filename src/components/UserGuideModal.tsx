import React from 'react';
import { X, BookOpen, Key, Settings, Play } from 'lucide-react';

// Get limits from environment variables with fallbacks
const getFileSizeLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_FILE_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

const getDurationLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_DURATION_MINUTES;
  return envLimit ? parseInt(envLimit) : 180; // Default 180 minutes (3 hours)
};

interface UserGuideModalProps {
  onClose: () => void;
  onOpenSettings: () => void;
}

const UserGuideModal: React.FC<UserGuideModalProps> = ({ onClose, onOpenSettings }) => {
  const handleOpenSettings = () => {
    onClose();
    onOpenSettings();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpen className="w-5 h-5 mr-2" />
            User Guide
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h3>
            <p className="text-gray-600 mb-4">
              Welcome to Meeting Transcriber! This application requires both Supabase connection and OpenAI API key for real transcription. 
              Follow these steps to get started:
            </p>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Key className="w-4 h-4 mr-2" />
                  Setup Required Services
                </h4>
                <p className="text-gray-600 mb-3">
                  You need to set up Supabase and get an OpenAI API key:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <h5 className="font-medium text-gray-800">Supabase Connection</h5>
                    <p className="text-sm text-gray-600">Required for secure server-side processing</p>
                    <p className="text-sm text-blue-600">
                      Click "Connect to Supabase" in the top right corner
                    </p>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800">OpenAI API Key</h5>
                    <p className="text-sm text-gray-600">Used for audio transcription and text summarization</p>
                    <p className="text-sm text-blue-600">
                      Get it from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenSettings}
                  className="mt-3 flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Open API Settings
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Play className="w-4 h-4 mr-2" />
                  Upload Your Audio File
                </h4>
                <p className="text-gray-600 mb-2">
                  Once your API keys are configured, you can upload your meeting audio:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Supported formats: MP3, WAV, AAC, M4A, OGG, WebM</li>
                  <li>• Maximum file size: {Math.round(getFileSizeLimit() / 1024 / 1024)}MB (≈{Math.round(getDurationLimit() / 60)} hours)</li>
                  <li>• Drag & drop or click "Choose Audio File"</li>
                  <li>• Large files (>50MB) use resumable uploads automatically</li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Review Results
                </h4>
                <p className="text-gray-600 mb-2">
                  The app will automatically:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Transcribe the audio using OpenAI Whisper</li>
                  <li>• Generate a summary with key points and action items</li>
                  <li>• Allow you to export both transcript and summary</li>
                  <li>• Store results locally for future reference</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• For best results, use clear audio recordings with minimal background noise</li>
              <li>• Long files (>100MB) are automatically processed in segments for better performance</li>
              <li>• You can customize export preferences in Settings → Export Preferences</li>
              <li>• All processing happens securely through Supabase edge functions</li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserGuideModal;