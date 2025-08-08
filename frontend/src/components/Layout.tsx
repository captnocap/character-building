import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LeftNav from './LeftNav';
import Inspector from './Inspector';
import WelcomeEmpty from '../sections/WelcomeEmpty';
import ProvidersSection from '../sections/ProvidersSection';
import ModelsSection from '../sections/ModelsSection';
import CharactersSection from '../sections/CharactersSection';
import ProfilesSection from '../sections/ProfilesSection';
import PresetsSection from '../sections/PresetsSection';
import TemplatesSection from '../sections/TemplatesSection';
import RulesSection from '../sections/RulesSection';
import ForgeSection from '../sections/ForgeSection';
import ConversationSection from '../sections/ConversationSection';
import ConversationsSection from '../sections/ConversationsSection';
import MessagesSection from '../sections/MessagesSection';
import MemoriesSection from '../sections/MemoriesSection';
import ContextSection from '../sections/ContextSection';
import ChatSection from '../sections/ChatSection';

export default function Layout() {
  return (
    <div className="h-screen grid grid-cols-builder">
      {/* Left Navigation */}
      <LeftNav />
      
      {/* Main Content */}
      <main className="overflow-hidden">
        <Routes>
          <Route path="/" element={<WelcomeEmpty />} />
          <Route path="/providers" element={<ProvidersSection />} />
          <Route path="/models" element={<ModelsSection />} />
          <Route path="/characters" element={<CharactersSection />} />
          <Route path="/profiles" element={<ProfilesSection />} />
          <Route path="/presets" element={<PresetsSection />} />
          <Route path="/templates" element={<TemplatesSection />} />
          <Route path="/rules" element={<RulesSection />} />
          <Route path="/forge" element={<ForgeSection />} />
          <Route path="/conversation" element={<ConversationSection />} />
          <Route path="/conversations" element={<ConversationsSection />} />
          <Route path="/messages" element={<MessagesSection />} />
          <Route path="/memories" element={<MemoriesSection />} />
          <Route path="/context" element={<ContextSection />} />
          <Route path="/chat" element={<ChatSection />} />
        </Routes>
      </main>
      
      {/* Right Inspector */}
      <Inspector />
    </div>
  );
}