import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: TemplateStep[];
  created_at: string;
}

interface TemplateStep {
  id: string;
  title: string;
  description: string;
  type: 'input' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  options?: string[];
  default_value?: string;
}

export default function TemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [wizardMode, setWizardMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepValues, setStepValues] = useState<Record<string, any>>({});
  const { dispatch } = useAppContext();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setEditingTemplate(template || null);
    setWizardMode(false);
    setCurrentStep(0);
    setStepValues({});
  };

  const createNewTemplate = async () => {
    try {
      const newTemplate = {
        name: 'New Template',
        description: '',
        category: 'general',
        steps: [
          {
            title: 'Basic Information',
            description: 'Enter basic template information',
            type: 'input',
            required: true
          }
        ]
      };
      
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      
      if (response.ok) {
        const created = await response.json();
        setTemplates(prev => [...prev, created]);
        selectTemplate(created.id);
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const updateTemplate = async (updates: Partial<Template>) => {
    if (!editingTemplate) return;
    
    try {
      const response = await fetch(`/api/templates/${editingTemplate.id}`, {
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
      await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (editingTemplate?.id === templateId) {
        setEditingTemplate(null);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const startWizard = () => {
    if (!editingTemplate) return;
    setWizardMode(true);
    setCurrentStep(0);
    setStepValues({});
  };

  const nextStep = () => {
    if (editingTemplate && currentStep < editingTemplate.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepValueChange = (stepId: string, value: any) => {
    setStepValues(prev => ({ ...prev, [stepId]: value }));
  };

  const completeWizard = async () => {
    try {
      const response = await fetch(`/api/templates/${editingTemplate?.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: stepValues })
      });
      
      if (response.ok) {
        const result = await response.json();
        setWizardMode(false);
        // Handle the generated content based on template type
        console.log('Template executed:', result);
      }
    } catch (error) {
      console.error('Failed to execute template:', error);
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));
  
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
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
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
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
                      <div className="text-sm text-gray-500 truncate">{template.description || 'No description'}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      <div>{template.category}</div>
                      <div>{template.steps.length} steps</div>
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
          wizardMode ? (
            /* Wizard Mode */
            <div className="max-w-2xl">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{editingTemplate.name}</h3>
                  <span className="text-sm text-gray-500">
                    Step {currentStep + 1} of {editingTemplate.steps.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / editingTemplate.steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current Step */}
              {editingTemplate.steps[currentStep] && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {editingTemplate.steps[currentStep].title}
                  </h4>
                  <p className="text-gray-600 mb-4">
                    {editingTemplate.steps[currentStep].description}
                  </p>

                  {/* Step Input */}
                  <div>
                    {editingTemplate.steps[currentStep].type === 'input' && (
                      <input
                        type="text"
                        value={stepValues[editingTemplate.steps[currentStep].id] || ''}
                        onChange={(e) => handleStepValueChange(editingTemplate.steps[currentStep].id, e.target.value)}
                        placeholder={editingTemplate.steps[currentStep].default_value}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}

                    {editingTemplate.steps[currentStep].type === 'textarea' && (
                      <textarea
                        value={stepValues[editingTemplate.steps[currentStep].id] || ''}
                        onChange={(e) => handleStepValueChange(editingTemplate.steps[currentStep].id, e.target.value)}
                        placeholder={editingTemplate.steps[currentStep].default_value}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}

                    {editingTemplate.steps[currentStep].type === 'select' && (
                      <select
                        value={stepValues[editingTemplate.steps[currentStep].id] || ''}
                        onChange={(e) => handleStepValueChange(editingTemplate.steps[currentStep].id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select an option...</option>
                        {editingTemplate.steps[currentStep].options?.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    )}

                    {editingTemplate.steps[currentStep].type === 'checkbox' && (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={stepValues[editingTemplate.steps[currentStep].id] || false}
                          onChange={(e) => handleStepValueChange(editingTemplate.steps[currentStep].id, e.target.checked)}
                          className="mr-2"
                        />
                        {editingTemplate.steps[currentStep].default_value || 'Enable this option'}
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <div>
                  <button
                    onClick={() => setWizardMode(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  {currentStep > 0 && (
                    <button
                      onClick={prevStep}
                      className="px-4 py-2 ml-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Previous
                    </button>
                  )}
                </div>
                <div>
                  {currentStep < editingTemplate.steps.length - 1 ? (
                    <button
                      onClick={nextStep}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={completeWizard}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Editor Mode */
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Template Editor</h3>
                <div className="flex gap-2">
                  <button
                    onClick={startWizard}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                  >
                    Test Wizard
                  </button>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingTemplate.category}
                    onChange={(e) => {
                      const updated = { ...editingTemplate, category: e.target.value };
                      setEditingTemplate(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateTemplate({ category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingTemplate.description}
                    onChange={(e) => {
                      const updated = { ...editingTemplate, description: e.target.value };
                      setEditingTemplate(updated);
                      dispatch({ type: 'SET_UI', payload: { dirty: true } });
                    }}
                    onBlur={(e) => updateTemplate({ description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Steps ({editingTemplate.steps.length})
                  </label>
                  <div className="space-y-2">
                    {editingTemplate.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{step.title}</div>
                          <div className="text-xs text-gray-500">{step.type} • {step.required ? 'Required' : 'Optional'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a template</div>
              <div className="text-sm">Choose a template from the list to edit or run its wizard</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}