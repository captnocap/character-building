import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function Inspector() {
  const { state, dispatch } = useAppContext();

  const handlePreviewContext = async () => {
    try {
      const response = await fetch('/api/preview/compile-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selection: state.selection,
          forge: state.forge,
        }),
      });
      const preview = await response.json();
      dispatch({ type: 'SET_PREVIEW', payload: preview });
    } catch (error) {
      console.error('Failed to preview context:', error);
    }
  };

  return (
    <aside className="bg-white border-l border-gray-200 p-3 flex flex-col gap-3">
      <button
        onClick={handlePreviewContext}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Preview Context
      </button>

      {/* Token Gauge */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Tokens</span>
          <span className="text-gray-900">
            {state.preview.tokens.used} / {state.preview.tokens.max}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{
              width: state.preview.tokens.max > 0 
                ? `${(state.preview.tokens.used / state.preview.tokens.max) * 100}%` 
                : '0%'
            }}
          ></div>
        </div>
      </div>

      {/* Score Breakdown */}
      {state.preview.rules.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="text-sm font-medium text-gray-900">Context Scoring</h5>
          <div className="flex flex-col gap-1">
            {state.preview.rules.map((rule, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{rule.name}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  ×{rule.weight.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Prompt */}
      {state.preview.prompt && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-900">Compiled Prompt (preview)</h5>
            <span className="text-xs text-gray-500">
              {Math.round(state.preview.prompt.length / 4)} est. tokens
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-md h-full overflow-auto whitespace-pre-wrap">
              {state.preview.prompt.length > 4000 
                ? state.preview.prompt.substring(0, 4000) + '...' 
                : state.preview.prompt}
            </pre>
          </div>
        </div>
      )}
    </aside>
  );
}