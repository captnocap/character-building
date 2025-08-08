import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatConfig {
  modelId: string;
  characterId?: string;
  profileId?: string;
  presetId?: string;
  useContext: boolean;
}

interface Model {
  id: string;
  name: string;
  provider_name: string;
}

interface Character {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
}

interface Preset {
  id: string;
  name: string;
}

export default function ChatSection() {
  const { state, dispatch } = useAppContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ChatConfig>({
    modelId: '',
    characterId: '',
    profileId: '',
    presetId: '',
    useContext: false
  });
  
  // Options for dropdowns
  const [models, setModels] = useState<Model[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadOptions = async () => {
    try {
      const [modelsRes, charactersRes, profilesRes, presetsRes] = await Promise.all([
        fetch('http://localhost:3000/api/models/options'),
        fetch('http://localhost:3000/api/characters/options'),
        fetch('http://localhost:3000/api/user-profiles/options'),
        fetch('http://localhost:3000/api/inference-presets/options')
      ]);
      
      const [modelsData, charactersData, profilesData, presetsData] = await Promise.all([
        modelsRes.json(),
        charactersRes.json(),
        profilesRes.json(),
        presetsRes.json()
      ]);
      
      setModels(modelsData);
      setCharacters(charactersData);
      setProfiles(profilesData);
      setPresets(presetsData);
      
      // Auto-select first model if available
      if (modelsData.length > 0 && !config.modelId) {
        setConfig(prev => ({ ...prev, modelId: modelsData[0].value }));
      }
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !config.modelId || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/conversations/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          config: config,
          messageHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update context info in inspector if available
        if (data.contextInfo) {
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
        const errorData = await response.json();
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Error: ${errorData.error || 'Failed to get response'}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: Failed to send message - ${error}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    dispatch({
      type: 'SET_PREVIEW',
      payload: {
        prompt: '',
        tokens: { used: 0, max: 0 },
        rules: []
      }
    });
  };

  const exportChat = () => {
    const chatData = {
      config,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      })),
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-500 text-white ml-auto';
      case 'assistant':
        return 'bg-gray-200 text-gray-800 mr-auto';
      case 'system':
        return 'bg-yellow-100 text-yellow-800 mx-auto text-center';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="h-full grid grid-cols-4">
      {/* Left: Chat Configuration */}
      <div className="border-r border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Chat Configuration</h2>
        
        <div className="space-y-4">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model *
            </label>
            <select
              value={config.modelId}
              onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select model...</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Character Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Character
            </label>
            <select
              value={config.characterId || ''}
              onChange={(e) => setConfig({ ...config, characterId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No character</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Profile
            </label>
            <select
              value={config.profileId || ''}
              onChange={(e) => setConfig({ ...config, profileId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Preset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inference Preset
            </label>
            <select
              value={config.presetId || ''}
              onChange={(e) => setConfig({ ...config, presetId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default settings</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Use Context Toggle */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.useContext}
                onChange={(e) => setConfig({ ...config, useContext: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Use context compilation</span>
            </label>
            <div className="text-xs text-gray-500 mt-1">
              Includes character description and user profile in system prompt
            </div>
          </div>
          
          {/* Chat Controls */}
          <div className="border-t pt-4 space-y-2">
            <button
              onClick={clearChat}
              className="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={messages.length === 0}
            >
              Clear Chat
            </button>
            <button
              onClick={exportChat}
              className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={messages.length === 0}
            >
              Export Chat
            </button>
          </div>
          
          {/* Current Config Summary */}
          <div className="border-t pt-4 text-xs text-gray-600">
            <div className="space-y-1">
              <div><strong>Model:</strong> {models.find(m => m.id === config.modelId)?.name || 'None'}</div>
              {config.characterId && (
                <div><strong>Character:</strong> {characters.find(c => c.id === config.characterId)?.name}</div>
              )}
              {config.profileId && (
                <div><strong>Profile:</strong> {profiles.find(p => p.id === config.profileId)?.name}</div>
              )}
              {config.presetId && (
                <div><strong>Preset:</strong> {presets.find(p => p.id === config.presetId)?.name}</div>
              )}
              <div><strong>Context:</strong> {config.useContext ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right: Chat Interface */}
      <div className="col-span-3 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Chat Playground</h2>
            <div className="text-sm text-gray-600">
              {messages.length} messages
            </div>
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <div>Start a conversation!</div>
                <div className="text-sm mt-1">
                  {config.modelId ? 'Type your message below' : 'Select a model to begin'}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className="flex">
                  <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${getMessageStyle(message.role)}`}>
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-1 opacity-70 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex mr-auto">
                  <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-xs">
                    <div className="flex items-center space-x-1">
                      <div className="animate-bounce">●</div>
                      <div className="animate-bounce delay-75">●</div>
                      <div className="animate-bounce delay-150">●</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={config.modelId ? "Type your message... (Press Enter to send, Shift+Enter for new line)" : "Select a model first..."}
              disabled={!config.modelId || isLoading}
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSendMessage}
              disabled={!config.modelId || !currentMessage.trim() || isLoading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 self-end"
            >
              {isLoading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                'Send'
              )}
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-gray-500">Quick:</span>
            <button
              onClick={() => setCurrentMessage("Hello! How are you today?")}
              className="text-blue-500 hover:text-blue-700"
              disabled={isLoading}
            >
              Greeting
            </button>
            <button
              onClick={() => setCurrentMessage("Can you tell me about yourself?")}
              className="text-blue-500 hover:text-blue-700"
              disabled={isLoading}
            >
              About
            </button>
            <button
              onClick={() => setCurrentMessage("What can you help me with?")}
              className="text-blue-500 hover:text-blue-700"
              disabled={isLoading}
            >
              Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}