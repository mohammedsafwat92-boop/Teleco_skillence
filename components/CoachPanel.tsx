import React from 'react';
import AdminPanel from './AdminPanel';
import { UserProfile } from '../types';

interface CoachPanelProps {
  onUpdateContent: () => void;
  currentUser: UserProfile;
  onImpersonate: (user: UserProfile) => void;
}

const CoachPanel: React.FC<CoachPanelProps> = ({ onUpdateContent, currentUser, onImpersonate }) => {
  return (
    <AdminPanel 
      onUpdateContent={onUpdateContent} 
      currentUser={currentUser} 
      onImpersonate={onImpersonate} 
    />
  );
};

export default CoachPanel;
