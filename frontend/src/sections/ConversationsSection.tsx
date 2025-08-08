import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Conversation } from '../types';

export default function ConversationsSection() {
  const { state, dispatch } = useAppContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  
  // New conversation form state
  const [newConversation, setNewConversation] = useState({
    name: '',
    model_id: '',
    user_profile_id: '',
    character_id: '',
    inference_preset_id: ''
  });

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    // Load full conversation details with messages
    try {
      const response = await fetch(`http://localhost:3000/api/conversations/${conversation.id}?include_messages=true`);
      const data = await response.json();
      dispatch({ type: 'SET_SELECTED_CONVERSATION', payload: data });
    } catch (error) {
      console.error('Failed to load conversation details:', error);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConversation)
      });
      
      if (response.ok) {
        const data = await response.json();
        await loadConversations();
        setShowNewDialog(false);
        setNewConversation({
          name: '',
          model_id: '',
          user_profile_id: '',
          character_id: '',
          inference_preset_id: ''
        });
        dispatch({ type: 'SET_SELECTED_CONVERSATION', payload: data });
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3000/api/conversations/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadConversations();
        if (state.selectedConversation?.id === id) {
          dispatch({ type: 'SET_SELECTED_CONVERSATION', payload: undefined });
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  return (
    <div className="h-full grid grid-cols-2">
      {/* Left: Conversations List */}
      <div className="border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Conversations</h2>
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
              placeholder="Search conversations..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Conversations List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations yet</div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  state.selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {conversation.name || 'Untitled Conversation'}
                    </h3>
                    <div className="mt-1 text-sm text-gray-500">
                      {conversation.character_name && (
                        <span className="mr-2">👤 {conversation.character_name}</span>
                      )}
                      {conversation.user_profile_name && (
                        <span className="mr-2">👥 {conversation.user_profile_name}</span>
                      )}
                      {conversation.model_name && (
                        <span>🤖 {conversation.model_name}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {conversation.message_count} messages • Updated {new Date(conversation.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation.id);
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
      
      {/* Right: Conversation Details */}
      <div className="overflow-y-auto">
        {state.selectedConversation ? (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">
              {state.selectedConversation.name || 'Untitled Conversation'}
            </h2>
            
            {/* Conversation Settings */}
            <div className="bg-gray-50 rounded p-4 mb-4">
              <h3 className="font-medium mb-2">Settings</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Character:</span>{' '}
                  <span className="font-medium">{state.selectedConversation.character_name || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Profile:</span>{' '}
                  <span className="font-medium">{state.selectedConversation.user_profile_name || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Model:</span>{' '}
                  <span className="font-medium">{state.selectedConversation.model_name || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Messages:</span>{' '}
                  <span className="font-medium">{state.selectedConversation.message_count}</span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                Continue Chat
              </button>
              <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                Fork Conversation
              </button>
              <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                Export
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a conversation to view details
          </div>
        )}
      </div>
      
      {/* New Conversation Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">New Conversation</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newConversation.name}
                  onChange={(e) => setNewConversation({ ...newConversation, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Conversation name..."
                />
              </div>
              
              {/* Add dropdowns for model, character, profile, preset */}
              {/* These would be populated from the options endpoints */}
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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