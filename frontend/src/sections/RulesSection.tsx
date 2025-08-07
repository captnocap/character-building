import React, { useState, useEffect } from 'react';
import { Rule } from '../types';
import { useAppContext } from '../context/AppContext';

export default function RulesSection() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const { dispatch } = useAppContext();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRule = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    setEditingRule(rule || null);
    setTestResults(null);
  };

  const createNewRule = async () => {
    try {
      const newRule = {
        name: 'New Rule',
        rule_type: 'relevance' as const,
        weight: 1.0,
        scope: 'global' as const,
        parameters: {}
      };
      
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      
      if (response.ok) {
        const created = await response.json();
        setRules(prev => [...prev, created]);
        selectRule(created.id);
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const updateRule = async (updates: Partial<Rule>) => {
    if (!editingRule) return;
    
    try {
      const response = await fetch(`/api/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updated = await response.json();
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        setEditingRule(updated);
        dispatch({ type: 'SET_UI', payload: { dirty: false } });
      }
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
      setRules(prev => prev.filter(r => r.id !== ruleId));
      if (editingRule?.id === ruleId) {
        setEditingRule(null);
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const testRule = async () => {
    if (!editingRule) return;
    
    setTesting(true);
    try {
      const response = await fetch(`/api/rules/${editingRule.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sample_data: {
            messages: [
              { content: 'Hello, how are you?', timestamp: new Date().toISOString() },
              { content: 'I am doing well, thank you!', timestamp: new Date().toISOString() }
            ]
          }
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
      }
    } catch (error) {
      console.error('Failed to test rule:', error);
    } finally {
      setTesting(false);
    }
  };

  const ruleTypes = ['recency', 'relevance', 'rating', 'recall_frequency', 'tag_based'];
  const ruleScopes = ['global', 'character', 'conversation'];
  
  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || rule.rule_type === selectedType;
    const matchesScope = selectedScope === 'all' || rule.scope === selectedScope;
    return matchesSearch && matchesType && matchesScope;
  });

  const getDefaultParameters = (ruleType: string) => {
    switch (ruleType) {
      case 'recency':
        return { decay_factor: 0.1, time_window_hours: 24 };
      case 'relevance':
        return { similarity_threshold: 0.7, max_results: 10 };
      case 'rating':
        return { min_rating: 3.0, boost_factor: 1.5 };
      case 'recall_frequency':
        return { frequency_threshold: 3, boost_multiplier: 2.0 };
      case 'tag_based':
        return { required_tags: [], excluded_tags: [], tag_weight: 1.2 };
      default:
        return {};
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading rules...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Context Rules</h2>
            <button
              onClick={createNewRule}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              New
            </button>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {ruleTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Scopes</option>
                {ruleScopes.map(scope => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredRules.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery || selectedType !== 'all' || selectedScope !== 'all' ? 'No rules found' : 'No rules created'}
            </div>
          ) : (
            <div className="p-2">
              {filteredRules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => selectRule(rule.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    editingRule?.id === rule.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-md flex items-center justify-center">
                      <span className="text-amber-600 text-sm">⚡</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{rule.name}</div>
                      <div className="text-sm text-gray-500">
                        {rule.rule_type} • {rule.scope} • {rule.weight}
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
        {editingRule ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Rule Editor</h3>
              <div className="flex gap-2">
                <button
                  onClick={testRule}
                  disabled={testing}
                  className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Rule'}
                </button>
                <button
                  onClick={() => deleteRule(editingRule.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="grid gap-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => {
                      const updated = { ...editingRule, name: e.target.value };
                      setEditingRule(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateRule({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRule.weight}
                    onChange={(e) => {
                      const updated = { ...editingRule, weight: parseFloat(e.target.value) };
                      setEditingRule(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateRule({ weight: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type</label>
                  <select
                    value={editingRule.rule_type}
                    onChange={(e) => {
                      const newType = e.target.value as Rule['rule_type'];
                      const defaultParams = getDefaultParameters(newType);
                      const updated = { 
                        ...editingRule, 
                        rule_type: newType,
                        parameters: { ...editingRule.parameters, ...defaultParams }
                      };
                      setEditingRule(updated);
                      updateRule({ rule_type: newType, parameters: updated.parameters });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ruleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    value={editingRule.scope}
                    onChange={(e) => {
                      const newScope = e.target.value as Rule['scope'];
                      const updated = { ...editingRule, scope: newScope };
                      setEditingRule(updated);
                      updateRule({ scope: newScope });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ruleScopes.map(scope => (
                      <option key={scope} value={scope}>{scope}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scope-specific fields */}
              {editingRule.scope !== 'global' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingRule.scope === 'character' ? 'Character ID' : 'Conversation ID'}
                  </label>
                  <input
                    type="text"
                    value={editingRule.scope === 'character' ? editingRule.character_id || '' : editingRule.conversation_id || ''}
                    onChange={(e) => {
                      const field = editingRule.scope === 'character' ? 'character_id' : 'conversation_id';
                      const updated = { ...editingRule, [field]: e.target.value };
                      setEditingRule(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => {
                      const field = editingRule.scope === 'character' ? 'character_id' : 'conversation_id';
                      updateRule({ [field]: e.target.value });
                    }}
                    placeholder={`Enter ${editingRule.scope} ID`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Parameters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parameters</label>
                <textarea
                  value={JSON.stringify(editingRule.parameters, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      const updated = { ...editingRule, parameters: parsed };
                      setEditingRule(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateRule({ parameters: parsed });
                    } catch (error) {
                      console.error('Invalid JSON for parameters');
                    }
                  }}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Test Results</h4>
                  <pre className="text-xs text-gray-700 overflow-auto">
                    {JSON.stringify(testResults, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a rule</div>
              <div className="text-sm">Choose a context rule from the list to edit its parameters</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}