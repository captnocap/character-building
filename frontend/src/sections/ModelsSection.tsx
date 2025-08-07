import React, { useState, useEffect } from 'react';
import { Model, Provider } from '../types';
import { useAppContext } from '../context/AppContext';

export default function ModelsSection() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderSlug, setSelectedProviderSlug] = useState<string>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modelsRes, providersRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/providers')
      ]);
      const [modelsData, providersData] = await Promise.all([
        modelsRes.json(),
        providersRes.json()
      ]);
      setModels(modelsData);
      setProviders(providersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectModel = (modelId: string) => {
    dispatch({ type: 'SET_SELECTION', payload: { key: 'modelId', value: modelId } });
  };

  const toggleFavorite = async (modelId: string) => {
    try {
      await fetch(`/api/models/${modelId}/favorite`, { method: 'POST' });
      setModels(prev => prev.map(model => 
        model.id === modelId ? { ...model, is_favorite: !model.is_favorite } : model
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const updateModel = async (modelId: string, updates: Partial<Model>) => {
    try {
      // Convert undefined to null for the API call since the database uses null
      const apiUpdates = { ...updates };
      if ('context_window_override' in apiUpdates && apiUpdates.context_window_override === undefined) {
        apiUpdates.context_window_override = null as any;
      }
      
      await fetch(`/api/models/${modelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates)
      });
      setModels(prev => prev.map(model => 
        model.id === modelId ? { ...model, ...updates } : model
      ));
      dispatch({ type: 'SET_UI', payload: { dirty: false } });
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  const selectedModel = models.find(m => m.id === state.selection.modelId);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (model.nickname && model.nickname.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesProvider = selectedProviderSlug === 'all' || model.provider_slug === selectedProviderSlug;
    const matchesFavorite = !showFavorites || model.is_favorite;
    return matchesSearch && matchesProvider && matchesFavorite;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Models List</h2>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <div className="flex gap-2">
              <select
                value={selectedProviderSlug}
                onChange={(e) => setSelectedProviderSlug(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Providers</option>
                {providers.map(provider => (
                  <option key={provider.slug} value={provider.slug}>
                    {provider.name} ({provider.slug})
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  showFavorites 
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                ★
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredModels.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {showFavorites ? 'No favorite models found' : 'No models found'}
            </div>
          ) : (
            <div className="p-2">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => selectModel(model.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    state.selection.modelId === model.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                      <span className="text-green-600 text-sm">🤖</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 truncate">
                          {model.nickname || model.name}
                        </div>
                        {model.is_favorite && (
                          <span className="text-yellow-500 text-xs">★</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {model.provider_name} ({model.provider_slug})
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      <div>
                        {((model.context_window_override || model.context_window) / 1000).toFixed(0)}K
                        {model.context_window_override && (
                          <div className="text-green-600">override</div>
                        )}
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
        {selectedModel ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Model Editor</h3>
              <button
                onClick={() => toggleFavorite(selectedModel.id)}
                className={`p-2 rounded-md transition-colors ${
                  selectedModel.is_favorite
                    ? 'text-yellow-500 hover:bg-yellow-50'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-yellow-500'
                }`}
              >
                ★
              </button>
            </div>
            
            <div className="grid gap-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedModel.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                <input
                  type="text"
                  value={selectedModel.nickname || ''}
                  onChange={(e) => {
                    setModels(prev => prev.map(model => 
                      model.id === selectedModel.id ? { ...model, nickname: e.target.value } : model
                    ));
                    dispatch({ type: 'SET_UI', payload: { dirty: true } });
                  }}
                  onBlur={(e) => updateModel(selectedModel.id, { nickname: e.target.value })}
                  placeholder="Optional display name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <input
                  type="text"
                  value={`${selectedModel.provider_name} (${selectedModel.provider_slug})`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Provider slug: {selectedModel.provider_slug}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Context Window</label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Default (from provider)</label>
                    <input
                      type="text"
                      value={`${selectedModel.context_window.toLocaleString()} tokens`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      User Override {selectedModel.context_window_override && '(Active)'}
                    </label>
                    <input
                      type="number"
                      value={selectedModel.context_window_override || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const override = value ? parseInt(value) : undefined;
                        setModels(prev => prev.map(model => 
                          model.id === selectedModel.id ? { ...model, context_window_override: override } : model
                        ));
                        dispatch({ type: 'SET_UI', payload: { dirty: true } });
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const override = value ? parseInt(value) : undefined;
                        updateModel(selectedModel.id, { context_window_override: override });
                      }}
                      placeholder="Override context window size"
                      min="1"
                      max="2000000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set a custom context window size. Leave empty to use default ({selectedModel.context_window.toLocaleString()} tokens).
                      {selectedModel.context_window_override && (
                        <span className="text-green-600 font-medium">
                          {' '}Currently using {selectedModel.context_window_override.toLocaleString()} tokens.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <div className="text-sm text-gray-600">
                  This model is {selectedModel.is_favorite ? 'marked as favorite' : 'not favorited'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a model</div>
              <div className="text-sm">Choose a model from the list to edit its settings</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}