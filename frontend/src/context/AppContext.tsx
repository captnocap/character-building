import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState } from '../types';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

type AppAction = 
  | { type: 'SET_SELECTION'; payload: { key: keyof AppState['selection']; value: string | undefined } }
  | { type: 'SET_UI'; payload: Partial<AppState['ui']> }
  | { type: 'SET_PREVIEW'; payload: Partial<AppState['preview']> }
  | { type: 'SET_FORGE'; payload: Partial<AppState['forge']> }
  | { type: 'SET_COUNTS'; payload: Partial<AppState['counts']> }
  | { type: 'ADD_TO_FORGE_TIMELINE'; payload: AppState['forge']['timeline'][0] }
  | { type: 'REMOVE_FROM_FORGE_TIMELINE'; payload: string }
  | { type: 'CLEAR_FORGE_TIMELINE' }
  | { type: 'SET_SELECTED_CONVERSATION'; payload: AppState['selectedConversation'] };

const initialState: AppState = {
  selection: {},
  ui: {
    forgeEnabled: false,
    dirty: false,
  },
  preview: {
    prompt: '',
    tokens: { used: 0, max: 0 },
    rules: [],
  },
  forge: {
    timeline: [],
  },
  counts: {
    providers: 0,
    models: 0,
    characters: 0,
    profiles: 0,
    presets: 0,
    templates: 0,
    rules: 0,
  },
  selectedConversation: undefined,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SELECTION':
      return {
        ...state,
        selection: {
          ...state.selection,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'SET_UI':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    case 'SET_PREVIEW':
      return {
        ...state,
        preview: { ...state.preview, ...action.payload },
      };
    case 'SET_FORGE':
      return {
        ...state,
        forge: { ...state.forge, ...action.payload },
      };
    case 'SET_COUNTS':
      return {
        ...state,
        counts: { ...state.counts, ...action.payload },
      };
    case 'ADD_TO_FORGE_TIMELINE':
      return {
        ...state,
        forge: {
          ...state.forge,
          timeline: [...state.forge.timeline, action.payload],
        },
      };
    case 'REMOVE_FROM_FORGE_TIMELINE':
      return {
        ...state,
        forge: {
          ...state.forge,
          timeline: state.forge.timeline.filter(item => item.id !== action.payload),
        },
      };
    case 'CLEAR_FORGE_TIMELINE':
      return {
        ...state,
        forge: {
          ...state.forge,
          timeline: [],
        },
      };
    case 'SET_SELECTED_CONVERSATION':
      return {
        ...state,
        selectedConversation: action.payload,
      };
    default:
      return state;
  }
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load counts on mount
  useEffect(() => {
    fetch('/api/build/counts')
      .then(res => res.json())
      .then(counts => dispatch({ type: 'SET_COUNTS', payload: counts }))
      .catch(console.error);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}