import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { apiClient } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationConfig {
  providerId?: string;
  modelId?: string;
  characterId?: string;
  profileId?: string;
  presetId?: string;
  useContext: boolean;
}

export default function ConversationSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConversationConfig>({
    useContext: true
  });
  
  // Dropdown options
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [conversationTemplates, setConversationTemplates] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { dispatch } = useAppContext();

  useEffect(() => {
    loadDropdownOptions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadDropdownOptions = async () => {
    try {
      const [providersRes, modelsRes, charactersRes, profilesRes, presetsRes] = await Promise.all([
        apiClient.getProviders(),
        apiClient.getModels(),
        apiClient.getCharacters(),
        apiClient.getProfiles(),
        apiClient.getPresets()
      ]);

      // Handle both array response and object with data arrays
      setProviders(Array.isArray(providersRes) ? providersRes : (providersRes.providers || []));
      setModels(Array.isArray(modelsRes) ? modelsRes : (modelsRes.models || []));
      setCharacters(Array.isArray(charactersRes) ? charactersRes : (charactersRes.characters || []));
      setProfiles(Array.isArray(profilesRes) ? profilesRes : (profilesRes.profiles || []));
      setPresets(Array.isArray(presetsRes) ? presetsRes : (presetsRes.presets || []));
      
      // Try to load conversation templates if they exist
      try {
        const templatesRes = await fetch('/api/conversations/templates');
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          const templatesArray = Array.isArray(templatesData) ? templatesData : (templatesData.templates || []);
          setConversationTemplates(templatesArray);
        }
      } catch (e) {
        // Templates endpoint might not exist yet
        setConversationTemplates([]);
      }
    } catch (error) {
      console.error('Failed to load dropdown options:', error);
    }
  };

  const loadTemplate = async (templateId: string) => {
    try {
      const template = conversationTemplates.find(t => t.id === templateId);
      if (template) {
        const model = models.find(m => m.id === template.model_id);
        setConfig({
          providerId: model?.provider_id,
          modelId: template.model_id,
          characterId: template.character_id,
          profileId: template.user_profile_id,
          presetId: template.inference_preset_id,
          useContext: true
        });
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send message to backend for AI response
      const response = await fetch('/api/conversations/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          config: config,
          messageHistory: messages.slice(-10) // Send last 10 messages for context
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Update preview in inspector if context was used
        if (config.useContext && data.contextInfo) {
          dispatch({
            type: 'SET_PREVIEW',
            payload: {
              prompt: data.contextInfo.compiledPrompt || '',
              tokens: data.contextInfo.tokens || { used: 0, max: 0 },
              rules: data.contextInfo.rules || []
            }
          });
        }
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Error: Failed to get AI response. Please check your configuration.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const selectedProvider = providers.find(p => p.id === config.providerId);
  const selectedModel = models.find(m => m.id === config.modelId);
  const selectedCharacter = characters.find(c => c.id === config.characterId);
  const selectedProfile = profiles.find(p => p.id === config.profileId);
  const selectedPreset = presets.find(p => p.id === config.presetId);

  return (
    <div className="h-full flex flex-col">
      {/* Configuration Header */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
          {/* Template Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quick Setup</label>
            <select
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onChange={(e) => e.target.value && loadTemplate(e.target.value)}
              value=""
            >
              <option value="">Load Template...</option>
              {conversationTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
            <select
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={config.modelId || ''}
              onChange={(e) => {
                const selectedModel = models.find(m => m.id === e.target.value);
                setConfig(prev => ({ 
                  ...prev, 
                  modelId: e.target.value || undefined,
                  providerId: selectedModel?.provider_id || undefined
                }));
              }}
            >
              <option value="">Select Model...</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>{model.nickname || model.name}</option>
              ))}
            </select>
          </div>

          {/* Character Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Character</label>
            <select
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={config.characterId || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, characterId: e.target.value || undefined }))}
            >
              <option value="">No Character</option>
              {characters.map(character => (
                <option key={character.id} value={character.id}>{character.name}</option>
              ))}
            </select>
          </div>

          {/* Profile Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">User Profile</label>
            <select
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={config.profileId || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, profileId: e.target.value || undefined }))}
            >
              <option value="">No Profile</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>

          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Preset</label>
            <select
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={config.presetId || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, presetId: e.target.value || undefined }))}
            >
              <option value="">Default Settings</option>
              {presets.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Configuration Summary & Context Toggle */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            {selectedModel?.nickname || selectedModel?.name || 'No Model'} • {selectedCharacter?.name || 'No Character'} • {selectedProfile?.name || 'No Profile'} • {selectedPreset?.name || 'Default'}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.useContext}
                onChange={(e) => setConfig(prev => ({ ...prev, useContext: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Use Context Rules</span>
            </label>
            <button
              onClick={clearMessages}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
            >
              Clear Messages
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-lg mb-2">Start a conversation</div>
              <div className="text-sm">Configure your AI settings above and send a message</div>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'system'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className={`text-xs mt-1 opacity-75`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || !config.modelId}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          {!config.modelId && (
            <div className="text-sm text-amber-600 mt-2">
              ⚠️ Please select a model to send messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}