import React, { useState } from 'react';
import { Meeting } from '../../types/meeting';
import MeetingsList from './pages/MeetingsList';
import MeetingDetail from './pages/MeetingDetail';
import MeetingForm from './pages/MeetingForm';
import ConflictResolver from './components/ConflictResolver';

type ViewMode = 'list' | 'detail' | 'form' | 'conflicts';

const MeetingsFeature: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [conflictMeeting, setConflictMeeting] = useState<Meeting | null>(null);

  const handleCreateMeeting = () => {
    setSelectedMeeting(null);
    setCurrentView('form');
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setCurrentView('form');
  };

  const handleViewMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setCurrentView('detail');
  };

  const handleShowConflictResolver = (meeting: Meeting) => {
    setConflictMeeting(meeting);
    setCurrentView('conflicts');
  };

  const handleSaveMeeting = (meeting: Meeting) => {
    setCurrentView('list');
    setSelectedMeeting(null);
  };

  const handleResolveConflicts = () => {
    setCurrentView('list');
    setConflictMeeting(null);
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedMeeting(null);
    setConflictMeeting(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'list' && (
          <MeetingsList
            onCreateMeeting={handleCreateMeeting}
            onEditMeeting={handleEditMeeting}
            onViewMeeting={handleViewMeeting}
          />
        )}

        {currentView === 'detail' && selectedMeeting && (
          <MeetingDetail
            meetingId={selectedMeeting.id}
            onBack={handleBack}
            onEdit={handleEditMeeting}
            onShowConflictResolver={handleShowConflictResolver}
          />
        )}

        {currentView === 'form' && (
          <MeetingForm
            meeting={selectedMeeting || undefined}
            onSave={handleSaveMeeting}
            onCancel={handleBack}
          />
        )}

        {currentView === 'conflicts' && conflictMeeting && (
          <ConflictResolver
            meeting={conflictMeeting}
            onResolve={handleResolveConflicts}
            onClose={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default MeetingsFeature;