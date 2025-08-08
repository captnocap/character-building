import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface Message {
  id: string;
  role: string;
  content: string;
  is_ghost: boolean;
  ghost_author?: string;
  rating?: number;
  tags: string[];
  created_at: string;
  position?: number;
  included_in_context?: boolean;
  context_weight?: number;
}

export default function MessagesSection() {
  const { state, dispatch } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    role: '',
    is_ghost: '',
    search: ''
  });

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.role) params.append('role', filter.role);
      if (filter.is_ghost) params.append('is_ghost', filter.is_ghost);
      if (filter.search) params.append('search', filter.search);
      
      const response = await fetch(`http://localhost:3000/api/messages?${params}`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateMessage = async (messageId: string, rating: number) => {
    try {
      const response = await fetch(`http://localhost:3000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating })
      });
      
      if (response.ok) {
        await loadMessages();
      }
    } catch (error) {
      console.error('Failed to rate message:', error);
    }
  };

  const handleToggleContext = async (messageId: string, included: boolean) => {
    if (!state.selectedConversation) return;
    
    try {
      const response = await fetch(
        `http://localhost:3000/api/conversations/${state.selectedConversation.id}/messages/${messageId}/context`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ included_in_context: included })
        }
      );
      
      if (response.ok) {
        await loadMessages();
      }
    } catch (error) {
      console.error('Failed to update message context:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return 'bg-blue-100 text-blue-800';
      case 'assistant': return 'bg-green-100 text-green-800';
      case 'system': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full grid grid-cols-2">
      {/* Left: Messages List */}
      <div className="border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          
          {/* Filters */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search messages..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex gap-2">
              <select
                value={filter.role}
                onChange={(e) => setFilter({ ...filter, role: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
                <option value="system">System</option>
              </select>
              
              <select
                value={filter.is_ghost}
                onChange={(e) => setFilter({ ...filter, is_ghost: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Messages</option>
                <option value="false">Regular</option>
                <option value="true">Ghost</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Messages List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No messages found</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs rounded ${getRoleColor(message.role)}`}>
                        {message.role}
                      </span>
                      {message.is_ghost && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Ghost {message.ghost_author && `by ${message.ghost_author}`}
                        </span>
                      )}
                      {message.rating && (
                        <span className="text-yellow-500">
                          {'★'.repeat(message.rating)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {message.content}
                    </p>
                    {message.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {message.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-0.5 text-xs bg-gray-200 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(message.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Right: Message Details */}
      <div className="overflow-y-auto">
        {selectedMessage ? (
          <div className="p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-3 py-1 text-sm rounded ${getRoleColor(selectedMessage.role)}`}>
                  {selectedMessage.role}
                </span>
                {selectedMessage.is_ghost && (
                  <span className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded">
                    Ghost Message
                  </span>
                )}
              </div>
              
              <div className="bg-gray-50 rounded p-4 mb-4">
                <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>
              
              {/* Message Metadata */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">ID:</span>{' '}
                  <span className="font-mono text-xs">{selectedMessage.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>{' '}
                  <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                </div>
                {selectedMessage.ghost_author && (
                  <div>
                    <span className="text-gray-500">Ghost Author:</span>{' '}
                    <span>{selectedMessage.ghost_author}</span>
                  </div>
                )}
                {selectedMessage.position !== undefined && (
                  <div>
                    <span className="text-gray-500">Position:</span>{' '}
                    <span>{selectedMessage.position}</span>
                  </div>
                )}
                {selectedMessage.context_weight !== undefined && (
                  <div>
                    <span className="text-gray-500">Context Weight:</span>{' '}
                    <span>{selectedMessage.context_weight}</span>
                  </div>
                )}
              </div>
              
              {/* Rating */}
              <div className="mt-4">
                <span className="text-gray-500 text-sm mr-2">Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRateMessage(selectedMessage.id, star)}
                    className={`text-2xl ${
                      selectedMessage.rating && selectedMessage.rating >= star
                        ? 'text-yellow-500'
                        : 'text-gray-300'
                    } hover:text-yellow-400`}
                  >
                    ★
                  </button>
                ))}
              </div>
              
              {/* Tags */}
              <div className="mt-4">
                <span className="text-gray-500 text-sm">Tags:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedMessage.tags.length > 0 ? (
                    selectedMessage.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 text-sm bg-gray-200 rounded">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm">No tags</span>
                  )}
                </div>
              </div>
              
              {/* Context Inclusion */}
              {state.selectedConversation && (
                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedMessage.included_in_context ?? true}
                      onChange={(e) => handleToggleContext(selectedMessage.id, e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Include in context compilation</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a message to view details
          </div>
        )}
      </div>
    </div>
  );
}