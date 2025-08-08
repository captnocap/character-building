import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface Memory {
  id: string;
  character_id?: string;
  label: string;
  content: string;
  category?: string;
  persistent: boolean;
  memory_weight: number;
  created_at: string;
}

interface Character {
  id: string;
  name: string;
}

export default function MemoriesSection() {
  const { state, dispatch } = useAppContext();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [filter, setFilter] = useState({
    character_id: '',
    category: '',
    search: ''
  });

  // New memory form state
  const [newMemory, setNewMemory] = useState({
    character_id: '',
    label: '',
    content: '',
    category: '',
    persistent: true,
    memory_weight: 1.0
  });

  useEffect(() => {
    loadCharacters();
    loadMemories();
  }, [filter]);

  const loadCharacters = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/characters/options');
      const data = await response.json();
      setCharacters(data);
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  };

  const loadMemories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.character_id) params.append('character_id', filter.character_id);
      if (filter.category) params.append('category', filter.category);
      if (filter.search) params.append('search', filter.search);
      
      const response = await fetch(`http://localhost:3000/api/memories?${params}`);
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemory = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newMemory)
      });
      
      if (response.ok) {
        await loadMemories();
        setShowNewDialog(false);
        setNewMemory({
          character_id: '',
          label: '',
          content: '',
          category: '',
          persistent: true,
          memory_weight: 1.0
        });
      }
    } catch (error) {
      console.error('Failed to create memory:', error);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this memory?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3000/api/memories/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadMemories();
        if (selectedMemory?.id === id) {
          setSelectedMemory(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const handleUpdateMemory = async (id: string, updates: Partial<Memory>) => {
    try {
      const response = await fetch(`http://localhost:3000/api/memories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        await loadMemories();
        if (selectedMemory?.id === id) {
          setSelectedMemory({ ...selectedMemory, ...updates });
        }
      }
    } catch (error) {
      console.error('Failed to update memory:', error);
    }
  };

  const getCategoryColor = (category?: string) => {
    const colors = {
      'personal': 'bg-blue-100 text-blue-800',
      'factual': 'bg-green-100 text-green-800',
      'emotional': 'bg-purple-100 text-purple-800',
      'activity': 'bg-orange-100 text-orange-800',
      'preference': 'bg-pink-100 text-pink-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="h-full grid grid-cols-2">
      {/* Left: Memories List */}
      <div className="border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Memories</h2>
            <button
              onClick={() => setShowNewDialog(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              New
            </button>
          </div>
          
          {/* Filters */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search memories..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex gap-2">
              <select
                value={filter.character_id}
                onChange={(e) => setFilter({ ...filter, character_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Characters</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                <option value="personal">Personal</option>
                <option value="factual">Factual</option>
                <option value="emotional">Emotional</option>
                <option value="activity">Activity</option>
                <option value="preference">Preference</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Memories List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : memories.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No memories found</div>
          ) : (
            memories.map((memory) => (
              <div
                key={memory.id}
                onClick={() => setSelectedMemory(memory)}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedMemory?.id === memory.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{memory.label}</h3>
                      {memory.category && (
                        <span className={`px-2 py-0.5 text-xs rounded ${getCategoryColor(memory.category)}`}>
                          {memory.category}
                        </span>
                      )}
                      {memory.persistent && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          Persistent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                      {memory.content}
                    </p>
                    <div className="text-xs text-gray-400">
                      Weight: {memory.memory_weight} • {new Date(memory.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMemory(memory.id);
                    }}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Right: Memory Details */}
      <div className="overflow-y-auto">
        {selectedMemory ? (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">{selectedMemory.label}</h2>
            
            <div className="space-y-4">
              {/* Memory Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={selectedMemory.content}
                  onChange={(e) => setSelectedMemory({ ...selectedMemory, content: e.target.value })}
                  onBlur={(e) => handleUpdateMemory(selectedMemory.id, { content: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={selectedMemory.category || ''}
                  onChange={(e) => {
                    const category = e.target.value || undefined;
                    setSelectedMemory({ ...selectedMemory, category });
                    handleUpdateMemory(selectedMemory.id, { category });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No category</option>
                  <option value="personal">Personal</option>
                  <option value="factual">Factual</option>
                  <option value="emotional">Emotional</option>
                  <option value="activity">Activity</option>
                  <option value="preference">Preference</option>
                </select>
              </div>
              
              {/* Memory Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Memory Weight: {selectedMemory.memory_weight}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={selectedMemory.memory_weight}
                  onChange={(e) => {
                    const weight = parseFloat(e.target.value);
                    setSelectedMemory({ ...selectedMemory, memory_weight: weight });
                  }}
                  onMouseUp={(e) => {
                    const weight = parseFloat((e.target as HTMLInputElement).value);
                    handleUpdateMemory(selectedMemory.id, { memory_weight: weight });
                  }}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  0 = Ignore, 1 = Normal, 2 = High Priority
                </div>
              </div>
              
              {/* Persistent Toggle */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedMemory.persistent}
                    onChange={(e) => {
                      const persistent = e.target.checked;
                      setSelectedMemory({ ...selectedMemory, persistent });
                      handleUpdateMemory(selectedMemory.id, { persistent });
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">Persistent (include in all conversations)</span>
                </label>
              </div>
              
              {/* Metadata */}
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div><strong>ID:</strong> <span className="font-mono text-xs">{selectedMemory.id}</span></div>
                <div><strong>Created:</strong> {new Date(selectedMemory.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a memory to view details
          </div>
        )}
      </div>
      
      {/* New Memory Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">New Memory</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Character
                </label>
                <select
                  value={newMemory.character_id}
                  onChange={(e) => setNewMemory({ ...newMemory, character_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select character...</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={newMemory.label}
                  onChange={(e) => setNewMemory({ ...newMemory, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Memory title..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Memory content..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newMemory.category}
                  onChange={(e) => setNewMemory({ ...newMemory, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No category</option>
                  <option value="personal">Personal</option>
                  <option value="factual">Factual</option>
                  <option value="emotional">Emotional</option>
                  <option value="activity">Activity</option>
                  <option value="preference">Preference</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newMemory.persistent}
                    onChange={(e) => setNewMemory({ ...newMemory, persistent: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Persistent memory</span>
                </label>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMemory}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!newMemory.label || !newMemory.content}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}