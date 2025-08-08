import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface ContextRule {
  id: string;
  name: string;
  rule_type: string;
  weight: number;
  parameters: any;
  scope: string;
  character_id?: string;
  conversation_id?: string;
  active: boolean;
}

interface ContextPreview {
  conversation_id: string;
  compiled: string;
  parts: Array<{
    type: string;
    role?: string;
    content: string;
    score?: number;
  }>;
  token_estimate: number;
  context_rules_applied: ContextRule[];
}

export default function ContextSection() {
  const { state, dispatch } = useAppContext();
  const [rules, setRules] = useState<ContextRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<ContextRule | null>(null);
  const [contextPreview, setContextPreview] = useState<ContextPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);
  
  // Preview configuration
  const [previewConfig, setPreviewConfig] = useState({
    conversation_id: '',
    user_input: '',
    max_tokens: 8000,
    context_adjustments: {}
  });

  // New rule form state
  const [newRule, setNewRule] = useState({
    name: '',
    rule_type: 'relevance',
    weight: 1.0,
    scope: 'global',
    character_id: '',
    conversation_id: '',
    parameters: {}
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/context/rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to load context rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewContext = async () => {
    if (!previewConfig.conversation_id) {
      alert('Please select a conversation to preview context');
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await fetch('http://localhost:3000/api/context/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(previewConfig)
      });
      
      if (response.ok) {
        const data = await response.json();
        setContextPreview(data);
        
        // Update preview state for Inspector
        dispatch({
          type: 'SET_PREVIEW',
          payload: {
            prompt: data.compiled,
            tokens: { used: data.token_estimate, max: previewConfig.max_tokens },
            rules: data.context_rules_applied.map((rule: ContextRule) => ({
              name: rule.name,
              weight: rule.weight
            }))
          }
        });
      }
    } catch (error) {
      console.error('Failed to preview context:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/context/rules', {
        method: 'PUT', // Using PUT as the API expects to update/insert rules
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rules: [newRule] })
      });
      
      if (response.ok) {
        await loadRules();
        setShowNewRuleDialog(false);
        setNewRule({
          name: '',
          rule_type: 'relevance',
          weight: 1.0,
          scope: 'global',
          character_id: '',
          conversation_id: '',
          parameters: {}
        });
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleToggleRuleActive = async (ruleId: string, active: boolean) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    try {
      const response = await fetch('http://localhost:3000/api/context/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rules: [{
            ...rule,
            active
          }]
        })
      });
      
      if (response.ok) {
        await loadRules();
      }
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const getRuleTypeColor = (type: string) => {
    const colors = {
      'relevance': 'bg-blue-100 text-blue-800',
      'recency': 'bg-green-100 text-green-800',
      'rating': 'bg-yellow-100 text-yellow-800',
      'recall_frequency': 'bg-purple-100 text-purple-800',
      'tag_based': 'bg-pink-100 text-pink-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getScopeColor = (scope: string) => {
    const colors = {
      'global': 'bg-gray-100 text-gray-800',
      'character': 'bg-blue-100 text-blue-800',
      'conversation': 'bg-green-100 text-green-800'
    };
    return colors[scope as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="h-full grid grid-cols-2">
      {/* Left: Context Rules */}
      <div className="border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Context Rules</h2>
            <button
              onClick={() => setShowNewRuleDialog(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              New Rule
            </button>
          </div>
          
          {/* Context Preview Controls */}
          <div className="space-y-2 mb-4">
            <h3 className="font-medium">Preview Context</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Conversation ID..."
                value={previewConfig.conversation_id}
                onChange={(e) => setPreviewConfig({ ...previewConfig, conversation_id: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="number"
                placeholder="Max tokens"
                value={previewConfig.max_tokens}
                onChange={(e) => setPreviewConfig({ ...previewConfig, max_tokens: parseInt(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <textarea
              placeholder="User input for context..."
              value={previewConfig.user_input}
              onChange={(e) => setPreviewConfig({ ...previewConfig, user_input: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={handlePreviewContext}
              disabled={previewLoading || !previewConfig.conversation_id}
              className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 text-sm"
            >
              {previewLoading ? 'Generating...' : 'Preview Context'}
            </button>
          </div>
        </div>
        
        {/* Rules List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No context rules found</div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                onClick={() => setSelectedRule(rule)}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedRule?.id === rule.id ? 'bg-blue-50' : ''
                } ${!rule.active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{rule.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${getRuleTypeColor(rule.rule_type)}`}>
                        {rule.rule_type}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${getScopeColor(rule.scope)}`}>
                        {rule.scope}
                      </span>
                      {!rule.active && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Weight: {rule.weight}
                    </div>
                  </div>
                  <label className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) => handleToggleRuleActive(rule.id, e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs">Active</span>
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Right: Context Preview or Rule Details */}
      <div className="overflow-y-auto">
        {contextPreview ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Context Preview</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Tokens: {contextPreview.token_estimate} / {previewConfig.max_tokens}</span>
                <div 
                  className="w-16 h-2 bg-gray-200 rounded overflow-hidden"
                  title={`${contextPreview.token_estimate} / ${previewConfig.max_tokens} tokens`}
                >
                  <div 
                    className={`h-full transition-all ${
                      contextPreview.token_estimate / previewConfig.max_tokens > 0.8 ? 'bg-red-500' :
                      contextPreview.token_estimate / previewConfig.max_tokens > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (contextPreview.token_estimate / previewConfig.max_tokens) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Context Parts */}
            <div className="space-y-3 mb-6">
              {contextPreview.parts.map((part, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      part.type === 'system' ? 'bg-gray-100 text-gray-800' :
                      part.type === 'user_input' ? 'bg-blue-100 text-blue-800' :
                      part.type === 'character' ? 'bg-purple-100 text-purple-800' :
                      part.type === 'memory' ? 'bg-green-100 text-green-800' :
                      part.type === 'message' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {part.type} {part.role && `(${part.role})`}
                    </span>
                    {part.score && (
                      <span className="text-xs text-gray-500">Score: {part.score.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {part.content.substring(0, 200)}
                    {part.content.length > 200 && '...'}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Applied Rules */}
            <div className="mb-6">
              <h3 className="font-medium mb-2">Applied Rules</h3>
              <div className="space-y-1">
                {contextPreview.context_rules_applied.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between text-sm">
                    <span>{rule.name}</span>
                    <span className="text-gray-500">Weight: {rule.weight}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Full Compiled Context */}
            <div>
              <h3 className="font-medium mb-2">Compiled Context</h3>
              <textarea
                value={contextPreview.compiled}
                readOnly
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
              />
            </div>
          </div>
        ) : selectedRule ? (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">{selectedRule.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Type
                </label>
                <span className={`inline-block px-3 py-1 text-sm rounded ${getRuleTypeColor(selectedRule.rule_type)}`}>
                  {selectedRule.rule_type}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <span className={`inline-block px-3 py-1 text-sm rounded ${getScopeColor(selectedRule.scope)}`}>
                  {selectedRule.scope}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight: {selectedRule.weight}
                </label>
                <div className="w-full bg-gray-200 rounded h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded transition-all"
                    style={{ width: `${Math.min(100, (selectedRule.weight / 2) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  0 = No influence, 1 = Normal, 2 = High influence
                </div>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRule.active}
                    onChange={(e) => handleToggleRuleActive(selectedRule.id, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
              
              {/* Parameters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parameters
                </label>
                <pre className="bg-gray-50 rounded p-3 text-sm overflow-auto">
                  {JSON.stringify(selectedRule.parameters, null, 2)}
                </pre>
              </div>
              
              {/* Metadata */}
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div><strong>ID:</strong> <span className="font-mono text-xs">{selectedRule.id}</span></div>
                {selectedRule.character_id && (
                  <div><strong>Character ID:</strong> <span className="font-mono text-xs">{selectedRule.character_id}</span></div>
                )}
                {selectedRule.conversation_id && (
                  <div><strong>Conversation ID:</strong> <span className="font-mono text-xs">{selectedRule.conversation_id}</span></div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a rule or preview context to view details
          </div>
        )}
      </div>
      
      {/* New Rule Dialog */}
      {showNewRuleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">New Context Rule</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rule name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Type
                </label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="recency">Recency</option>
                  <option value="rating">Rating</option>
                  <option value="recall_frequency">Recall Frequency</option>
                  <option value="tag_based">Tag Based</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <select
                  value={newRule.scope}
                  onChange={(e) => setNewRule({ ...newRule, scope: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="global">Global</option>
                  <option value="character">Character</option>
                  <option value="conversation">Conversation</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight: {newRule.weight}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={newRule.weight}
                  onChange={(e) => setNewRule({ ...newRule, weight: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowNewRuleDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!newRule.name}
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