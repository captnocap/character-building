import React, { useState, useEffect } from 'react';
import { Preset } from '../types';
import { useAppContext } from '../context/AppContext';

export default function PresetsSection() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const { dispatch } = useAppContext();

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await fetch('/api/presets');
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    setEditingPreset(preset || null);
  };

  const createNewPreset = async () => {
    try {
      const newPreset = {
        name: 'New Preset',
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        max_tokens: 1000,
        frequency_penalty: 0,
        presence_penalty: 0,
        repetition_penalty: 1.1
      };
      
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreset)
      });
      
      if (response.ok) {
        const created = await response.json();
        setPresets(prev => [...prev, created]);
        selectPreset(created.id);
      }
    } catch (error) {
      console.error('Failed to create preset:', error);
    }
  };

  const updatePreset = async (updates: Partial<Preset>) => {
    if (!editingPreset) return;
    
    try {
      const response = await fetch(`/api/presets/${editingPreset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updated = await response.json();
        setPresets(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingPreset(updated);
        dispatch({ type: 'SET_UI', payload: { dirty: false } });
      }
    } catch (error) {
      console.error('Failed to update preset:', error);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!window.confirm('Are you sure you want to delete this preset?')) return;
    
    try {
      await fetch(`/api/presets/${presetId}`, { method: 'DELETE' });
      setPresets(prev => prev.filter(p => p.id !== presetId));
      if (editingPreset?.id === presetId) {
        setEditingPreset(null);
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
  };

  const handleSliderChange = (field: keyof Preset, value: number) => {
    if (!editingPreset) return;
    
    const updated = { ...editingPreset, [field]: value };
    setEditingPreset(updated);
    dispatch({ type: 'SET_UI', payload: { dirty: true } });
    
    // Debounced update
    setTimeout(() => updatePreset({ [field]: value }), 500);
  };

  const selectedPreset = editingPreset;

  const filteredPresets = presets.filter(preset =>
    preset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading presets...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Model Presets</h2>
            <button
              onClick={createNewPreset}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              New
            </button>
          </div>
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredPresets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No presets found' : 'No presets created'}
            </div>
          ) : (
            <div className="p-2">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    editingPreset?.id === preset.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                      <span className="text-orange-600 text-sm">⚙️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{preset.name}</div>
                      <div className="text-sm text-gray-500">
                        T:{preset.temperature} • P:{preset.top_p} • Tokens:{preset.max_tokens}
                      </div>
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
        {selectedPreset ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Preset Editor</h3>
              <button
                onClick={() => deletePreset(selectedPreset.id)}
                className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>

            <div className="space-y-6 max-w-2xl">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedPreset.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setEditingPreset(prev => prev ? { ...prev, name: newName } : null);
                    dispatch({ type: 'SET_UI', payload: { dirty: true } });
                  }}
                  onBlur={(e) => updatePreset({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature: {selectedPreset.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={selectedPreset.temperature}
                  onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Conservative (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              {/* Top P */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Top P: {selectedPreset.top_p}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={selectedPreset.top_p}
                  onChange={(e) => handleSliderChange('top_p', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Focused (0.1)</span>
                  <span>Balanced (0.5)</span>
                  <span>Diverse (1.0)</span>
                </div>
              </div>

              {/* Top K */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Top K: {selectedPreset.top_k}
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={selectedPreset.top_k}
                  onChange={(e) => handleSliderChange('top_k', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Focused (1)</span>
                  <span>Balanced (40)</span>
                  <span>Diverse (100)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens: {selectedPreset.max_tokens}
                </label>
                <input
                  type="range"
                  min="50"
                  max="4000"
                  step="50"
                  value={selectedPreset.max_tokens}
                  onChange={(e) => handleSliderChange('max_tokens', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Short (50)</span>
                  <span>Medium (1000)</span>
                  <span>Long (4000)</span>
                </div>
              </div>

              {/* Frequency Penalty */}
              {selectedPreset.frequency_penalty !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency Penalty: {selectedPreset.frequency_penalty}
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={selectedPreset.frequency_penalty}
                    onChange={(e) => handleSliderChange('frequency_penalty', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Encourage (-2)</span>
                    <span>Neutral (0)</span>
                    <span>Discourage (2)</span>
                  </div>
                </div>
              )}

              {/* Presence Penalty */}
              {selectedPreset.presence_penalty !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Presence Penalty: {selectedPreset.presence_penalty}
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={selectedPreset.presence_penalty}
                    onChange={(e) => handleSliderChange('presence_penalty', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Encourage (-2)</span>
                    <span>Neutral (0)</span>
                    <span>Discourage (2)</span>
                  </div>
                </div>
              )}

              {/* Repetition Penalty */}
              {selectedPreset.repetition_penalty !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repetition Penalty: {selectedPreset.repetition_penalty}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={selectedPreset.repetition_penalty}
                    onChange={(e) => handleSliderChange('repetition_penalty', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Allow (0.5)</span>
                    <span>Neutral (1)</span>
                    <span>Discourage (2)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a preset</div>
              <div className="text-sm">Choose a model preset from the list to adjust its parameters</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}