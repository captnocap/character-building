export interface Provider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom_openai' | 'local';
  base_url: string;
  api_key_ref: string;
}

export interface Model {
  id: string;
  name: string;
  nickname?: string;
  provider_name: string;
  context_window: number;
  is_favorite: boolean;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  format_type: 'plain' | 'markdown' | 'json';
  mood_variants?: any;
  internal_state?: any;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  format_type: 'plain' | 'markdown' | 'json';
}

export interface Preset {
  id: string;
  name: string;
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
}

export interface Rule {
  id: string;
  name: string;
  rule_type: 'recency' | 'relevance' | 'rating' | 'recall_frequency' | 'tag_based';
  weight: number;
  scope: 'global' | 'character' | 'conversation';
  character_id?: string;
  conversation_id?: string;
  parameters: any;
}

export interface BuildCounts {
  providers: number;
  models: number;
  characters: number;
  profiles: number;
  presets: number;
  templates: number;
  rules: number;
}

export interface AppState {
  selection: {
    providerId?: string;
    modelId?: string;
    characterId?: string;
    profileId?: string;
  };
  ui: {
    forgeEnabled: boolean;
    dirty: boolean;
  };
  preview: {
    prompt: string;
    tokens: {
      used: number;
      max: number;
    };
    rules: Array<{
      name: string;
      weight: number;
    }>;
  };
  forge: {
    timeline: Array<{
      id: string;
      type: 'message' | 'memory' | 'profile' | 'character' | 'injection';
      label: string;
      content: any;
    }>;
  };
  counts: BuildCounts;
}