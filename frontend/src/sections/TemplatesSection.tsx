import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface Template {
  id: string;
  name: string;
  user_profile_id?: string;
  character_id?: string;
  model_id?: string;
  prompt_wrapper_id?: string;
  response_tone_id?: string;
  response_setting_id?: string;
  inference_preset_id?: string;
  created_at: string;
  // Extended fields from joins
  user_profile_name?: string;
  character_name?: string;
  model_name?: string;
  preset_name?: string;
}

export default function TemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { dispatch } = useAppContext();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/conversations/templates');
      const data = await response.json();
      // Handle both array response and object with templates array
      const templatesArray = Array.isArray(data) ? data : (data.templates || []);
      setTemplates(templatesArray);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      // For now, set empty array if templates endpoint doesn't work
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setEditingTemplate(template || null);
  };

  const createNewTemplate = async () => {
    try {
      const newTemplate = {
        name: 'New Template' // Only name is required for conversation_templates
      };
      
      const response = await fetch('/api/conversations/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      
      if (response.ok) {
        const created = await response.json();
        setTemplates(prev => [...prev, created]);
        selectTemplate(created.id);
      } else {
        console.error('Failed to create template:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const updateTemplate = async (updates: Partial<Template>) => {
    if (!editingTemplate) return;
    
    try {
      const response = await fetch(`/api/conversations/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updated = await response.json();
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        setEditingTemplate(updated);
        dispatch({ type: 'SET_UI', payload: { dirty: false } });
      }
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await fetch(`/api/conversations/templates/${templateId}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (editingTemplate?.id === templateId) {
        setEditingTemplate(null);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };


  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all'; // No categories for conversation templates
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
            <button
              onClick={createNewTemplate}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              New
            </button>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            {/* No category selector for conversation templates */}
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredTemplates.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery || selectedCategory !== 'all' ? 'No templates found' : 'No templates created'}
            </div>
          ) : (
            <div className="p-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    editingTemplate?.id === template.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-pink-100 rounded-md flex items-center justify-center">
                      <span className="text-pink-600 text-sm">📋</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{template.name}</div>
                      <div className="text-sm text-gray-500 truncate">
                        {template.character_name || 'No character'} • {template.model_name || 'No model'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      <div>{template.user_profile_name || 'No profile'}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Editor/Wizard */}
      <div className="flex-1 p-6">
        {editingTemplate ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Template Editor</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteTemplate(editingTemplate.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => {
                      const updated = { ...editingTemplate, name: e.target.value };
                      setEditingTemplate(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateTemplate({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associated Character</label>
                  <div className="text-sm text-gray-600 mb-3">
                    {editingTemplate.character_name || 'No character selected'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associated Model</label>
                  <div className="text-sm text-gray-600 mb-3">
                    {editingTemplate.model_name || 'No model selected'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associated User Profile</label>
                  <div className="text-sm text-gray-600 mb-3">
                    {editingTemplate.user_profile_name || 'No profile selected'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associated Preset</label>
                  <div className="text-sm text-gray-600">
                    {editingTemplate.preset_name || 'No preset selected'}
                  </div>
                </div>
              </div>
            </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a template</div>
              <div className="text-sm">Choose a template from the list to edit its configuration</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}