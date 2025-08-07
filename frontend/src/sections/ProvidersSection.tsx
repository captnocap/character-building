import React, { useState, useEffect } from 'react';
import { Provider } from '../types';
import { useAppContext } from '../context/AppContext';

export default function ProvidersSection() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      setProviders(data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProvider = (providerId: string) => {
    dispatch({ type: 'SET_SELECTION', payload: { key: 'providerId', value: providerId } });
  };

  const selectedProvider = providers.find(p => p.id === state.selection.providerId);

  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Providers List</h2>
          <input
            type="text"
            placeholder="Search providers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredProviders.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No providers found' : 'No providers configured'}
            </div>
          ) : (
            <div className="p-2">
              {filteredProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => selectProvider(provider.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    state.selection.providerId === provider.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <span className="text-blue-600 text-sm">☁</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{provider.name}</div>
                      <div className="text-sm text-gray-500">{provider.type}</div>
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-24">
                      {provider.base_url}
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
        {selectedProvider ? (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Editor</h3>
            <div className="grid gap-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedProvider.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={selectedProvider.type}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom_openai">Custom OpenAI</option>
                  <option value="local">Local</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                <input
                  type="text"
                  value={selectedProvider.base_url}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key Reference</label>
                <input
                  type="text"
                  value={selectedProvider.api_key_ref}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                  Ping
                </button>
                <button className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a provider</div>
              <div className="text-sm">Choose a provider from the list to edit its settings</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}