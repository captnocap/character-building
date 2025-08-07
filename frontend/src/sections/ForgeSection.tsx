import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

interface ForgeSource {
  id: string;
  type: 'message' | 'memory' | 'profile' | 'character' | 'injection';
  label: string;
  content: any;
  metadata?: any;
}

export default function ForgeSection() {
  const [sources, setSources] = useState<ForgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const { state, dispatch } = useAppContext();

  const generatePreview = useCallback(async () => {
    if (state.forge.timeline.length === 0) {
      setPreview('');
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await fetch('/api/forge/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: state.forge.timeline })
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data.preview);
        
        // Update token count and rule weights in preview
        dispatch({ 
          type: 'SET_PREVIEW', 
          payload: {
            prompt: data.preview,
            tokens: data.tokens || { used: 0, max: 0 },
            rules: data.rules || []
          }
        });
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [state.forge.timeline, dispatch]);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const fetchSources = async () => {
    try {
      // Fetch available sources from multiple endpoints
      const [messagesRes, memoriesRes, profilesRes, charactersRes] = await Promise.all([
        fetch('/api/messages?limit=50'),
        fetch('/api/memories?limit=50'),
        fetch('/api/profiles'),
        fetch('/api/characters')
      ]);

      const [messages, memories, profiles, characters] = await Promise.all([
        messagesRes.json(),
        memoriesRes.json(),
        profilesRes.json(),
        charactersRes.json()
      ]);

      const allSources: ForgeSource[] = [
        ...messages.map((msg: any) => ({
          id: `msg-${msg.id}`,
          type: 'message' as const,
          label: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
          content: msg.content,
          metadata: { timestamp: msg.timestamp, role: msg.role }
        })),
        ...memories.map((mem: any) => ({
          id: `mem-${mem.id}`,
          type: 'memory' as const,
          label: mem.description || 'Memory',
          content: mem.content,
          metadata: { importance: mem.importance, tags: mem.tags }
        })),
        ...profiles.map((profile: any) => ({
          id: `profile-${profile.id}`,
          type: 'profile' as const,
          label: profile.name,
          content: profile.description,
          metadata: { format_type: profile.format_type }
        })),
        ...characters.map((char: any) => ({
          id: `char-${char.id}`,
          type: 'character' as const,
          label: char.name,
          content: char.description,
          metadata: { format_type: char.format_type }
        }))
      ];

      setSources(allSources);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  };


  const addToTimeline = (source: ForgeSource) => {
    const timelineItem = {
      id: `timeline-${Date.now()}-${source.id}`,
      type: source.type,
      label: source.label,
      content: source.content
    };
    
    dispatch({ type: 'ADD_TO_FORGE_TIMELINE', payload: timelineItem });
  };

  const removeFromTimeline = (itemId: string) => {
    dispatch({ type: 'REMOVE_FROM_FORGE_TIMELINE', payload: itemId });
  };

  const clearTimeline = () => {
    dispatch({ type: 'CLEAR_FORGE_TIMELINE' });
  };

  const moveTimelineItem = (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = state.forge.timeline.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= state.forge.timeline.length) return;

    const newTimeline = [...state.forge.timeline];
    const [item] = newTimeline.splice(currentIndex, 1);
    newTimeline.splice(newIndex, 0, item);

    dispatch({ type: 'SET_FORGE', payload: { timeline: newTimeline } });
  };

  const filteredSources = sources.filter(source => {
    const matchesSearch = source.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (typeof source.content === 'string' && source.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || source.type === selectedType;
    return matchesSearch && matchesType;
  });

  const sourceTypes = ['message', 'memory', 'profile', 'character', 'injection'];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading forge sources...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Column - Sources */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sources</h2>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {sourceTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredSources.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery || selectedType !== 'all' ? 'No sources found' : 'No sources available'}
            </div>
          ) : (
            <div className="p-2">
              {filteredSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => addToTimeline(source)}
                  className="w-full p-3 mb-2 text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                      source.type === 'message' ? 'bg-blue-100 text-blue-600' :
                      source.type === 'memory' ? 'bg-purple-100 text-purple-600' :
                      source.type === 'profile' ? 'bg-indigo-100 text-indigo-600' :
                      source.type === 'character' ? 'bg-pink-100 text-pink-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {source.type === 'message' ? '💬' :
                       source.type === 'memory' ? '🧠' :
                       source.type === 'profile' ? '🧑' :
                       source.type === 'character' ? '👤' :
                       '💉'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{source.label}</div>
                      <div className="text-xs text-gray-500 capitalize">{source.type}</div>
                    </div>
                    <div className="text-xs text-gray-400">+</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Column - Timeline Builder */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            <button
              onClick={clearTimeline}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {state.forge.timeline.length} items • Drag to reorder
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {state.forge.timeline.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <div className="mb-2">Timeline is empty</div>
              <div className="text-sm">Add sources from the left panel to build your context</div>
            </div>
          ) : (
            <div className="p-2">
              {state.forge.timeline.map((item, index) => (
                <div
                  key={item.id}
                  className="mb-2 p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">{index + 1}</span>
                      <div className={`w-4 h-4 rounded text-xs flex items-center justify-center ${
                        item.type === 'message' ? 'bg-blue-100 text-blue-600' :
                        item.type === 'memory' ? 'bg-purple-100 text-purple-600' :
                        item.type === 'profile' ? 'bg-indigo-100 text-indigo-600' :
                        item.type === 'character' ? 'bg-pink-100 text-pink-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {item.type === 'message' ? '💬' :
                         item.type === 'memory' ? '🧠' :
                         item.type === 'profile' ? '🧑' :
                         item.type === 'character' ? '👤' :
                         '💉'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveTimelineItem(item.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveTimelineItem(item.id, 'down')}
                        disabled={index === state.forge.timeline.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeFromTimeline(item.id)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">{item.label}</div>
                  <div className="text-xs text-gray-500 capitalize">{item.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <div className="text-sm text-gray-500">
              {state.preview.tokens.used > 0 && (
                <span>
                  {state.preview.tokens.used.toLocaleString()} / {state.preview.tokens.max.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
          
          {state.preview.rules.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {state.preview.rules.map((rule, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800"
                >
                  {rule.name} ({rule.weight})
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {previewLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Generating preview...</div>
            </div>
          ) : preview ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border">
                {preview}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-center text-gray-500">
              <div>
                <div className="text-lg mb-2">No preview available</div>
                <div className="text-sm">Add items to the timeline to generate a context preview</div>
              </div>
            </div>
          )}
        </div>
        
        {preview && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Context ready for generation
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
                Generate Response
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}