'use client';

import { useState } from 'react';
import type { CharacterId } from '@/lib/types';
import WelcomePage from '@/components/WelcomePage';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [stage, setStage] = useState<'welcome' | 'chat'>('welcome');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('naina');
  const [userName, setUserName] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const handleSelect = (id: CharacterId, name: string) => {
    setUserName(name);
    setTransitioning(true);
    setTimeout(() => {
      setSelectedCharacter(id);
      setStage('chat');
      setTransitioning(false);
    }, 350);
  };

  const handleBack = () => {
    setTransitioning(true);
    setTimeout(() => {
      setStage('welcome');
      setTransitioning(false);
    }, 350);
  };

  return (
    <main
      className="relative z-10 h-screen w-screen overflow-hidden"
      style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'scale(0.98)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {stage === 'welcome' ? (
        <WelcomePage onSelect={handleSelect} />
      ) : (
        <ChatInterface initialCharacter={selectedCharacter} onBack={handleBack} userName={userName} />
      )}
    </main>
  );
}
