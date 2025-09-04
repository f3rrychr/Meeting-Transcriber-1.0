import React, { useState } from 'react';
import { X, Key, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ApiKeys } from '../types';
import { validateAPIKeys } from '../services/apiService';
import ConnectionStatus from './ConnectionStatus';

interface SettingsModalProps {
  apiKeys: ApiKeys;
  onSave: (keys: ApiKeys) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ apiKeys, onSave, onClose }) => {
  const [keys, setKeys] = useState(apiKeys);
  const [showKeys, setShowKeys] = useState({ openai: false, huggingface: false });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateKey = (key: string, value: string): string | null => {
    if (!value.trim()) {
      return 'API key is required';
    }
    
    if (key === 'openai' && !value.startsWith('sk-')) {
      return 'OpenAI API key should start with "sk-"';
    }
    
    if (key === 'huggingface' && !value.startsWith('hf_')) {
      return 'Hugging Face API token should start with "hf_"';
    }
    
    return null;
  };

  const handleSave = () => {
    const validation = validateAPIKeys(keys);
    
    if (!validation.isValid) {
      const newErrors: { [key: string]: string } = {};
      validation.errors.forEach(error => {
        if (error.includes('OpenAI')) {
          newErrors.openai = error;
        } else if (error.includes('Hugging Face')) {
          newErrors.huggingface = error;
        }
      });
      setErrors(newErrors);
      return;
    }
    
    onSave(keys);
    onClose();
  };

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const toggleKeyVisibility = (key: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Key className="w-5 h-5 mr-2" />
            API Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Supabase Connection Status */}
          <ConnectionStatus />

          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={showKeys.openai ? 'text' : 'password'}
                value={keys.openai}
                onChange={(e) => handleKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.openai ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('openai')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.openai && (
              <p className="mt-2 text-sm text-red-600">{errors.openai}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Used for audio transcription and text summarization
            </p>
          </div>

          {/* Hugging Face API Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hugging Face API Token
            </label>
            <div className="relative">
              <input
                type={showKeys.huggingface ? 'text' : 'password'}
                value={keys.huggingface}
                onChange={(e) => handleKeyChange('huggingface', e.target.value)}
                placeholder="hf_..."
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.huggingface ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('huggingface')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKeys.huggingface ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.huggingface && (
              <p className="mt-2 text-sm text-red-600">{errors.huggingface}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Used for speaker diarization (speaker identification)
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Getting API Keys</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• OpenAI: Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a></p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Supabase Connection Required</h4>
            <div className="text-sm text-green-800 space-y-1">
              <p>• Real transcription requires Supabase Edge Functions</p>
              <p>• Click "Connect to Supabase" button in the top right corner</p>
              <p>• Edge functions handle OpenAI API calls server-side</p>
              <p>• This bypasses browser CORS restrictions</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-900 mb-1">Important Notes</h4>
                <div className="text-sm text-amber-800 space-y-1">
                  <p>• API keys are stored locally in your browser</p>
                  <p>• Both keys are required for full functionality</p>
                  <p>• API usage will be charged to your accounts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;