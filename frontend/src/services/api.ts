const API_BASE = process.env.REACT_APP_API_BASE || '';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Build endpoints
  getBuildCounts() {
    return this.request<any>('/api/build/counts');
  }

  // Provider endpoints
  getProviders(cursor?: string) {
    const query = cursor ? `?cursor=${cursor}` : '';
    return this.request<any>(`/api/providers${query}`);
  }

  getProvider(id: string) {
    return this.request<any>(`/api/providers/${id}`);
  }

  updateProvider(id: string, data: any) {
    return this.request<any>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  pingProvider(id: string) {
    return this.request<any>(`/api/providers/${id}/ping`, {
      method: 'POST',
    });
  }

  deleteProvider(id: string) {
    return this.request<any>(`/api/providers/${id}`, {
      method: 'DELETE',
    });
  }

  // Model endpoints
  getModels(cursor?: string, providerId?: string, providerSlug?: string, fav?: boolean) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (providerId) params.set('provider_id', providerId);
    if (providerSlug) params.set('provider_slug', providerSlug);
    if (fav !== undefined) params.set('is_favorite', fav.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.request<any>(`/api/models${query}`);
  }

  getModel(id: string) {
    return this.request<any>(`/api/models/${id}`);
  }

  updateModel(id: string, data: any) {
    return this.request<any>(`/api/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  toggleModelFavorite(id: string) {
    return this.request<any>(`/api/models/${id}/favorite`, {
      method: 'POST',
    });
  }

  syncModelsFromProvider() {
    return this.request<any>('/api/models/syncFromProvider', {
      method: 'POST',
    });
  }

  // Character endpoints
  getCharacters(cursor?: string, q?: string) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (q) params.set('q', q);
    const query = params.toString() ? `?${params}` : '';
    return this.request<any>(`/api/characters${query}`);
  }

  getCharacter(id: string) {
    return this.request<any>(`/api/characters/${id}`);
  }

  updateCharacter(id: string, data: any) {
    return this.request<any>(`/api/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  updateCharacterJson(id: string, data: any) {
    return this.request<any>(`/api/characters/${id}/json`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Profile endpoints
  getProfiles(cursor?: string) {
    const query = cursor ? `?cursor=${cursor}` : '';
    return this.request<any>(`/api/user-profiles${query}`);
  }

  getProfile(id: string) {
    return this.request<any>(`/api/user-profiles/${id}`);
  }

  createProfile(data: any) {
    return this.request<any>('/api/user-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateProfile(id: string, data: any) {
    return this.request<any>(`/api/user-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Preset endpoints
  getPresets() {
    return this.request<any>('/api/inference-presets');
  }

  getPreset(id: string) {
    return this.request<any>(`/api/inference-presets/${id}`);
  }

  createPreset(data: any) {
    return this.request<any>('/api/inference-presets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updatePreset(id: string, data: any) {
    return this.request<any>(`/api/inference-presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Template endpoints
  getWrapperOptions() {
    return this.request<any>('/api/wrappers/options');
  }

  getToneOptions() {
    return this.request<any>('/api/tones/options');
  }

  createConversationFromTemplate(data: any) {
    return this.request<any>('/api/templates/create-conversation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Rule endpoints
  getRules() {
    return this.request<any>('/api/rules');
  }

  getRule(id: string) {
    return this.request<any>(`/api/rules/${id}`);
  }

  createRule(data: any) {
    return this.request<any>('/api/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateRule(id: string, data: any) {
    return this.request<any>(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  testRule(id: string, data: any) {
    return this.request<any>(`/api/rules/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Message endpoints
  getMessages(cursor?: string, role?: string, rating?: number, tag?: string, q?: string) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (role) params.set('role', role);
    if (rating) params.set('rating', rating.toString());
    if (tag) params.set('tag', tag);
    if (q) params.set('q', q);
    const query = params.toString() ? `?${params}` : '';
    return this.request<any>(`/api/messages${query}`);
  }

  // Memory endpoints
  getMemories(characterId?: string, q?: string) {
    const params = new URLSearchParams();
    if (characterId) params.set('characterId', characterId);
    if (q) params.set('q', q);
    const query = params.toString() ? `?${params}` : '';
    return this.request<any>(`/api/memories${query}`);
  }

  // Conversation endpoints
  getConversationOptions() {
    return this.request<any>('/api/conversations/options');
  }

  // Preview endpoints
  compileContext(data: any) {
    return this.request<any>('/api/preview/compile-context', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Forge endpoints
  saveForgeSession(data: any) {
    return this.request<any>('/api/forge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  createConversationFromForge(data: any) {
    return this.request<any>('/api/forge/create-conversation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();