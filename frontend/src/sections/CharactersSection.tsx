import React, { useState, useEffect } from 'react';
import { Character } from '../types';
import { useAppContext } from '../context/AppContext';

export default function CharactersSection() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'mood' | 'state'>('profile');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/characters');
      const data = await response.json();
      setCharacters(data);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCharacter = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    dispatch({ type: 'SET_SELECTION', payload: { key: 'characterId', value: characterId } });
    setEditingCharacter(character || null);
  };

  const createNewCharacter = async () => {
    try {
      const newCharacter = {
        name: 'New Character',
        description: '',
        format_type: 'plain' as const
      };
      
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCharacter)
      });
      
      if (response.ok) {
        const created = await response.json();
        setCharacters(prev => [...prev, created]);
        selectCharacter(created.id);
      }
    } catch (error) {
      console.error('Failed to create character:', error);
    }
  };

  const updateCharacter = async (updates: Partial<Character>) => {
    if (!editingCharacter) return;
    
    try {
      const response = await fetch(`/api/characters/${editingCharacter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updated = await response.json();
        setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
        setEditingCharacter(updated);
        dispatch({ type: 'SET_UI', payload: { dirty: false } });
      }
    } catch (error) {
      console.error('Failed to update character:', error);
    }
  };

  const deleteCharacter = async (characterId: string) => {
    if (!window.confirm('Are you sure you want to delete this character?')) return;
    
    try {
      await fetch(`/api/characters/${characterId}`, { method: 'DELETE' });
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      if (state.selection.characterId === characterId) {
        dispatch({ type: 'SET_SELECTION', payload: { key: 'characterId', value: undefined } });
        setEditingCharacter(null);
      }
    } catch (error) {
      console.error('Failed to delete character:', error);
    }
  };

  const selectedCharacter = characters.find(c => c.id === state.selection.characterId);

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    character.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading characters...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Characters</h2>
            <button
              onClick={createNewCharacter}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              New
            </button>
          </div>
          <input
            type="text"
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredCharacters.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No characters found' : 'No characters created'}
            </div>
          ) : (
            <div className="p-2">
              {filteredCharacters.map((character) => (
                <button
                  key={character.id}
                  onClick={() => selectCharacter(character.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    state.selection.characterId === character.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                      <span className="text-purple-600 text-sm">👤</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{character.name}</div>
                      <div className="text-sm text-gray-500 truncate">{character.description || 'No description'}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {character.format_type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 p-6">
        {selectedCharacter ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Character Editor</h3>
              <button
                onClick={() => deleteCharacter(selectedCharacter.id)}
                className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex space-x-8">
                {[
                  { key: 'profile', label: 'Profile' },
                  { key: 'mood', label: 'Mood Variants' },
                  { key: 'state', label: 'Internal State' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
              <div className="grid gap-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingCharacter?.name || selectedCharacter.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setEditingCharacter(prev => prev ? { ...prev, name: newName } : null);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateCharacter({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format Type</label>
                  <select
                    value={editingCharacter?.format_type || selectedCharacter.format_type}
                    onChange={(e) => {
                      const newType = e.target.value as Character['format_type'];
                      setEditingCharacter(prev => prev ? { ...prev, format_type: newType } : null);
                      updateCharacter({ format_type: newType });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="plain">Plain Text</option>
                    <option value="markdown">Markdown</option>
                    <option value="json">JSON</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingCharacter?.description || selectedCharacter.description}
                    onChange={(e) => {
                      const newDesc = e.target.value;
                      setEditingCharacter(prev => prev ? { ...prev, description: newDesc } : null);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateCharacter({ description: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Character description and personality..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'mood' && (
              <div className="max-w-2xl">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mood Variants</label>
                  <p className="text-sm text-gray-500 mb-3">Define different personality variations for this character</p>
                </div>
                <textarea
                  value={JSON.stringify(selectedCharacter.mood_variants || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditingCharacter(prev => prev ? { ...prev, mood_variants: parsed } : null);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateCharacter({ mood_variants: parsed });
                    } catch (error) {
                      console.error('Invalid JSON for mood variants');
                    }
                  }}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder='{"happy": {"description": "Cheerful and optimistic"}, "serious": {"description": "Focused and analytical"}}'
                />
              </div>
            )}

            {activeTab === 'state' && (
              <div className="max-w-2xl">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Internal State</label>
                  <p className="text-sm text-gray-500 mb-3">Define internal state variables and memory for this character</p>
                </div>
                <textarea
                  value={JSON.stringify(selectedCharacter.internal_state || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditingCharacter(prev => prev ? { ...prev, internal_state: parsed } : null);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateCharacter({ internal_state: parsed });
                    } catch (error) {
                      console.error('Invalid JSON for internal state');
                    }
                  }}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder='{"memory": [], "goals": [], "relationships": {}}'
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a character</div>
              <div className="text-sm">Choose a character from the list to edit its profile</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}