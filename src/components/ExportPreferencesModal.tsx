import React, { useState } from 'react';
import { X, Download, Save } from 'lucide-react';

interface ExportPreferences {
  defaultFormat: 'txt' | 'docx' | 'pdf';
  includeTimestamps: boolean;
  timestampInterval: number;
  defaultLocation: 'source' | 'desktop' | 'documents';
  customLocation: string;
  filenamePrefix: string;
  includeSpeakerLabels: boolean;
  includeMetadata: boolean;
}

interface ExportPreferencesModalProps {
  preferences: ExportPreferences;
  onSave: (preferences: ExportPreferences) => void;
  onClose: () => void;
}

const ExportPreferencesModal: React.FC<ExportPreferencesModalProps> = ({ 
  preferences, 
  onSave, 
  onClose 
}) => {
  const [prefs, setPrefs] = useState(preferences);

  const handleSave = () => {
    onSave(prefs);
    onClose();
  };

  const updatePreference = <K extends keyof ExportPreferences>(
    key: K, 
    value: ExportPreferences[K]
  ) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Export Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Default Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Export Format
            </label>
            <select
              value={prefs.defaultFormat}
              onChange={(e) => updatePreference('defaultFormat', e.target.value as 'txt' | 'docx' | 'pdf')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="txt">TXT</option>
              <option value="docx">DOCX</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          {/* Timestamps */}
          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="includeTimestamps"
                checked={prefs.includeTimestamps}
                onChange={(e) => updatePreference('includeTimestamps', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="includeTimestamps" className="text-sm font-medium text-gray-700">
                Include Timestamps
              </label>
            </div>
            {prefs.includeTimestamps && (
              <div className="ml-6">
                <label className="block text-sm text-gray-600 mb-1">
                  Timestamp Interval (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={prefs.timestampInterval}
                  onChange={(e) => updatePreference('timestampInterval', parseInt(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
          </div>

          {/* Speaker Labels */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeSpeakerLabels"
              checked={prefs.includeSpeakerLabels}
              onChange={(e) => updatePreference('includeSpeakerLabels', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="includeSpeakerLabels" className="text-sm font-medium text-gray-700">
              Include Speaker Labels
            </label>
          </div>

          {/* Metadata */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeMetadata"
              checked={prefs.includeMetadata}
              onChange={(e) => updatePreference('includeMetadata', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="includeMetadata" className="text-sm font-medium text-gray-700">
              Include Meeting Metadata
            </label>
          </div>

          {/* Default Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Save Location
            </label>
            <select
              value={prefs.defaultLocation}
              onChange={(e) => updatePreference('defaultLocation', e.target.value as 'source' | 'desktop' | 'documents')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="source">Same folder as source audio</option>
              <option value="desktop">Desktop</option>
              <option value="documents">Documents folder</option>
            </select>
          </div>

          {/* Filename Prefix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename Prefix (optional)
            </label>
            <input
              type="text"
              value={prefs.filenamePrefix}
              onChange={(e) => updatePreference('filenamePrefix', e.target.value)}
              placeholder="e.g., Meeting_"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Files will be named: {prefs.filenamePrefix}filename_transcript.{prefs.defaultFormat}
            </p>
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
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPreferencesModal;