'use client';

import { useState, useEffect } from 'react';
import type { CharacterId } from '@/lib/types';
import WelcomePage from '@/components/WelcomePage';
import ChatInterface from '@/components/ChatInterface';

const NAME_KEY = 'friend-ai-username';
const SHORTCUT_IDS = ['naina', 'bunny', 'aarav', 'maya'] as const;

export default function Home() {
  const [stage, setStage] = useState<'welcome' | 'chat'>('welcome');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('naina');
  const [userName, setUserName] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // Home-screen shortcuts ("Chat with Bunny") open /?c=<id> and should land
  // straight in that conversation. Only for someone who's already given their
  // name — a first-time visitor still gets the welcome screen, since skipping
  // it would leave the characters with no idea what to call them.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('c');
    if (!requested || !(SHORTCUT_IDS as readonly string[]).includes(requested)) return;

    const savedName = localStorage.getItem(NAME_KEY) ?? '';
    if (!savedName) return;

    setUserName(savedName);
    setSelectedCharacter(requested as CharacterId);
    setStage('chat');
    // Drop the param so a later refresh (or "back to characters") isn't
    // yanked into the same chat again.
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

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
      className="relative z-10 w-full app-screen overflow-y-auto"
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
