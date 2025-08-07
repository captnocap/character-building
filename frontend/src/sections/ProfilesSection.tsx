import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { useAppContext } from '../context/AppContext';

export default function ProfilesSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/user-profiles');
      const data = await response.json();
      // Handle both array response and object with profiles array
      const profilesArray = Array.isArray(data) ? data : (data.profiles || []);
      setProfiles(profilesArray);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    dispatch({ type: 'SET_SELECTION', payload: { key: 'profileId', value: profileId } });
    setEditingProfile(profile || null);
  };

  const createNewProfile = async () => {
    try {
      const newProfile = {
        name: 'New Profile',
        description: 'A new user profile', // Required by validation
        format_type: 'plain' as const
      };
      
      const response = await fetch('/api/user-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      
      if (response.ok) {
        const created = await response.json();
        setProfiles(prev => [...prev, created]);
        selectProfile(created.id);
      } else {
        console.error('Failed to create profile:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!editingProfile) return;
    
    try {
      const response = await fetch(`/api/user-profiles/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updated = await response.json();
        setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingProfile(updated);
        dispatch({ type: 'SET_UI', payload: { dirty: false } });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;
    
    try {
      await fetch(`/api/user-profiles/${profileId}`, { method: 'DELETE' });
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      if (state.selection.profileId === profileId) {
        dispatch({ type: 'SET_SELECTION', payload: { key: 'profileId', value: undefined } });
        setEditingProfile(null);
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const selectedProfile = profiles.find(p => p.id === state.selection.profileId);

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">User Profiles</h2>
            <button
              onClick={createNewProfile}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              New
            </button>
          </div>
          <input
            type="text"
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredProfiles.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No profiles found' : 'No profiles created'}
            </div>
          ) : (
            <div className="p-2">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => selectProfile(profile.id)}
                  className={`w-full p-3 mb-2 text-left rounded-lg border transition-colors ${
                    state.selection.profileId === profile.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-md flex items-center justify-center">
                      <span className="text-indigo-600 text-sm">🧑</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{profile.name}</div>
                      <div className="text-sm text-gray-500 truncate">{profile.description || 'No description'}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {profile.format_type}
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
        {selectedProfile ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Profile Editor</h3>
              <button
                onClick={() => deleteProfile(selectedProfile.id)}
                className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>

            <div className="grid gap-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingProfile?.name || selectedProfile.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setEditingProfile(prev => prev ? { ...prev, name: newName } : null);
                    dispatch({ type: 'SET_UI', payload: { dirty: true } });
                  }}
                  onBlur={(e) => updateProfile({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format Type</label>
                <select
                  value={editingProfile?.format_type || selectedProfile.format_type}
                  onChange={(e) => {
                    const newType = e.target.value as Profile['format_type'];
                    setEditingProfile(prev => prev ? { ...prev, format_type: newType } : null);
                    updateProfile({ format_type: newType });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="plain">Plain Text</option>
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingProfile?.description || selectedProfile.description}
                  onChange={(e) => {
                    const newDesc = e.target.value;
                    setEditingProfile(prev => prev ? { ...prev, description: newDesc } : null);
                    dispatch({ type: 'SET_UI', payload: { dirty: true } });
                  }}
                  onBlur={(e) => updateProfile({ description: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="User profile description, background, preferences, and context..."
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Guidelines</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Use plain text for simple user information</p>
                  <p>• Use markdown for formatted descriptions with structure</p>
                  <p>• Use JSON for structured data with specific fields</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">Select a profile</div>
              <div className="text-sm">Choose a user profile from the list to edit its details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}