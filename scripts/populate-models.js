#!/usr/bin/env node
import { PrismaClient } from '../src/generated/prisma/index.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Provider API configurations
const PROVIDER_CONFIGS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    parseModels: (data) => data.data.map(model => ({
      name: model.id,
      context_window: getOpenAIContextWindow(model.id),
      nickname: null
    }))
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/models',
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    parseModels: (data) => data.data?.map(model => ({
      name: model.id,
      context_window: getAnthropicContextWindow(model.id),
      nickname: model.display_name || null
    })) || []
  },
  custom_openai: {
    endpoint: (baseUrl) => {
      // Handle different OpenAI-compatible API paths
      if (baseUrl.includes('nano-gpt.com')) {
        return `${baseUrl}/api/v1/models`;
      }
      return `${baseUrl}/v1/models`;
    },
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    parseModels: (data) => data.data?.map(model => ({
      name: model.id,
      context_window: model.context_length || 4096,
      nickname: model.name || null
    })) || []
  },
  local: {
    // For Ollama
    endpoint: (baseUrl = 'http://localhost:11434') => `${baseUrl}/api/tags`,
    headers: () => ({}),
    parseModels: (data) => data.models?.map(model => ({
      name: model.name,
      context_window: model.details?.parameter_size ? getOllamaContextWindow(model.name) : 4096,
      nickname: model.name.split(':')[0] // Remove version tag
    })) || []
  }
};

// Context window mappings for known models
function getOpenAIContextWindow(modelId) {
  const contextMap = {
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-1106-preview': 128000,
    'gpt-4-0125-preview': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 4096,
    'gpt-3.5-turbo-16k': 16384,
    'gpt-3.5-turbo-1106': 16385,
    'text-davinci-003': 4097,
    'text-davinci-002': 4097
  };
  return contextMap[modelId] || 4096;
}

function getAnthropicContextWindow(modelId) {
  const contextMap = {
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-2.1': 200000,
    'claude-2.0': 100000,
    'claude-instant-1.2': 100000
  };
  return contextMap[modelId] || 200000;
}

function getOllamaContextWindow(modelName) {
  // Extract base model name and map to known context windows
  const baseName = modelName.split(':')[0].toLowerCase();
  const contextMap = {
    'llama3.1': 128000,
    'llama3': 8192,
    'llama2': 4096,
    'mistral': 32768,
    'mixtral': 32768,
    'phi': 2048,
    'gemma': 8192,
    'qwen': 32768,
    'codellama': 16384
  };
  
  for (const [model, context] of Object.entries(contextMap)) {
    if (baseName.includes(model)) return context;
  }
  return 4096; // Default
}

// Fetch models from a provider
async function fetchModelsFromProvider(provider, apiKeyRef, baseUrl) {
  const config = PROVIDER_CONFIGS[provider.type];
  if (!config) {
    console.log(`⚠️  No configuration for provider type: ${provider.type}`);
    return [];
  }
  
  let apiKey = apiKeyRef;
  
  // Use stored API key directly if it looks like a key, otherwise try environment variables
  if (apiKeyRef && (apiKeyRef.startsWith('sk-') || apiKeyRef.startsWith('claude-') || apiKeyRef.includes('-'))) {
    apiKey = apiKeyRef;
  } else if (apiKeyRef) {
    // Try environment variable with the reference name
    apiKey = process.env[apiKeyRef];
    
    if (!apiKey) {
      // Try standard environment variable patterns
      const envKey = `${provider.type.toUpperCase()}_API_KEY`;
      apiKey = process.env[envKey];
      
      if (!apiKey) {
        console.log(`⚠️  No API key found for ${provider.name} (tried: ${apiKeyRef}, ${envKey})`);
        return [];
      }
    }
  } else {
    console.log(`⚠️  No API key configured for ${provider.name}`);
    return [];
  }
  
  try {
    const endpoint = typeof config.endpoint === 'function' 
      ? config.endpoint(baseUrl || provider.base_url)
      : config.endpoint;
      
    const headers = config.headers(apiKey);
    
    console.log(`📡 Fetching models from ${provider.name} (${endpoint})...`);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      timeout: 10000
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch from ${provider.name}: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    const models = config.parseModels(data);
    
    console.log(`✅ Found ${models.length} models from ${provider.name}`);
    return models;
    
  } catch (error) {
    console.log(`❌ Error fetching from ${provider.name}: ${error.message}`);
    return [];
  }
}

// Main function
async function populateModels() {
  console.log('🤖 Populating models from provider endpoints...\n');
  
  try {
    // Get all providers
    const providers = await prisma.providers.findMany();
    
    if (providers.length === 0) {
      console.log('⚠️  No providers found in database');
      return;
    }
    
    let totalModelsAdded = 0;
    let totalModelsUpdated = 0;
    
    for (const provider of providers) {
      console.log(`\n🏢 Processing provider: ${provider.name} (${provider.type})`);
      
      // Skip if no configuration exists
      if (!PROVIDER_CONFIGS[provider.type]) {
        console.log(`   ⏭️  Skipping - no configuration available`);
        continue;
      }
      
      // Fetch models from provider API
      const fetchedModels = await fetchModelsFromProvider(provider, provider.api_key_ref, provider.base_url);
      
      if (fetchedModels.length === 0) {
        console.log(`   ⚠️  No models fetched`);
        continue;
      }
      
      // Upsert models into database
      for (const modelData of fetchedModels) {
        try {
          const existing = await prisma.models.findFirst({
            where: {
              provider_id: provider.id,
              name: modelData.name
            }
          });
          
          if (existing) {
            // Update existing model
            await prisma.models.update({
              where: { id: existing.id },
              data: {
                nickname: modelData.nickname,
                context_window: modelData.context_window
              }
            });
            totalModelsUpdated++;
            console.log(`   ✏️  Updated: ${modelData.name} (${modelData.context_window} tokens)`);
          } else {
            // Create new model
            await prisma.models.create({
              data: {
                provider_id: provider.id,
                name: modelData.name,
                nickname: modelData.nickname,
                context_window: modelData.context_window,
                is_favorite: false
              }
            });
            totalModelsAdded++;
            console.log(`   ✅ Added: ${modelData.name} (${modelData.context_window} tokens)`);
          }
        } catch (error) {
          console.log(`   ❌ Failed to save ${modelData.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n🎉 Model population complete!`);
    console.log(`   📦 Added: ${totalModelsAdded} models`);
    console.log(`   ✏️  Updated: ${totalModelsUpdated} models`);
    
  } catch (error) {
    console.error('❌ Error during model population:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line execution
if (process.argv[1].endsWith('populate-models.js')) {
  populateModels().catch(console.error);
}

export { populateModels };