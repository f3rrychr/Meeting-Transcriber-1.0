import React, { useState } from 'react';
import { Menu, Settings, HelpCircle, FileText, RotateCcw, Download } from 'lucide-react';

interface MenuBarProps {
  onOpenSettings: () => void;
  onShowAbout: () => void;
  onShowExportPrefs: () => void;
  onShowUserGuide: () => void;
  onShowTranscriptionHistory: () => void;
  onShowActionTracker: () => void;
  onReset: () => void;
  hasContent: boolean;
  onOpenFile: () => void;
  onExportTranscript: () => void;
  onExportSummary: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onOpenSettings, onShowAbout, onShowExportPrefs, onShowUserGuide, onShowTranscriptionHistory, onReset, hasContent, onOpenFile, onExportTranscript, onExportSummary }) => {
const MenuBar: React.FC<MenuBarProps> = ({ onOpenSettings, onShowAbout, onShowExportPrefs, onShowUserGuide, onShowTranscriptionHistory, onShowActionTracker, onReset, hasContent, onOpenFile, onExportTranscript, onExportSummary }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const handleMenuItemClick = (action: () => void) => {
    setActiveMenu(null); // Close menu first
    action(); // Then execute action
  };

  const menuItems = [
    {
      label: 'File',
      items: [
        { label: 'Open Audio File', shortcut: 'Ctrl+O', action: () => handleMenuItemClick(onOpenFile) },
        { label: 'Export Transcript', shortcut: 'Ctrl+E', action: () => handleMenuItemClick(onExportTranscript), disabled: !hasContent },
        { label: 'Export Summary', shortcut: 'Ctrl+Shift+E', action: () => handleMenuItemClick(onExportSummary), disabled: !hasContent },
        { type: 'separator' },
        { label: 'Exit', shortcut: 'Alt+F4', action: () => handleMenuItemClick(() => window.close()) }
      ]
    },
    {
      label: 'Settings',
      items: [
        { label: 'API Keys', action: () => handleMenuItemClick(onOpenSettings) },
        { label: 'Export Preferences', action: () => handleMenuItemClick(onShowExportPrefs) }
      ]
    },
    {
      label: 'Dashboard',
      items: [
        { label: 'Transcription Records', action: () => handleMenuItemClick(onShowTranscriptionHistory) },
        { label: 'Action Tracker', action: () => handleMenuItemClick(onShowActionTracker) }
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'About', action: () => handleMenuItemClick(onShowAbout) },
        { label: 'User Guide', action: () => handleMenuItemClick(onShowUserGuide) }
      ]
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2">
      <div className="flex items-center space-x-6">
        {menuItems.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
              onMouseEnter={() => setActiveMenu(menu.label)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              {menu.label}
            </button>
            
            {activeMenu === menu.label && (
              <div 
                className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                onMouseEnter={() => setActiveMenu(menu.label)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {menu.items.map((item, index) => (
                  item.type === 'separator' ? (
                    <div key={index} className="border-t border-gray-200 my-1" />
                  ) : (
                    <button
                      key={index}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                        item.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'
                      }`}
                      onClick={() => !item.disabled && item.action()}
                      disabled={item.disabled}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-gray-400">{item.shortcut}</span>
                      )}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
        
        <div className="flex-1" />
        
        {hasContent && (
          <button
            onClick={onReset}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Session</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MenuBar;