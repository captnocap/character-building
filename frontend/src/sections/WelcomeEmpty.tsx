import React from 'react';
import { Link } from 'react-router-dom';

export default function WelcomeEmpty() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Builder</h1>
        <p className="text-gray-600 mb-6">
          Get started by setting up your providers, models, and characters to build powerful AI conversations.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Link
            to="/providers"
            className="p-3 border border-gray-200 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="font-medium text-gray-900">Start with Providers</div>
            <div className="text-gray-500 mt-1">Add your AI service providers</div>
          </Link>
          <Link
            to="/characters"
            className="p-3 border border-gray-200 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="font-medium text-gray-900">Create Characters</div>
            <div className="text-gray-500 mt-1">Define AI personalities</div>
          </Link>
          <Link
            to="/templates"
            className="p-3 border border-gray-200 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="font-medium text-gray-900">Build Templates</div>
            <div className="text-gray-500 mt-1">Create conversation templates</div>
          </Link>
          <Link
            to="/forge"
            className="p-3 border border-gray-200 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="font-medium text-gray-900">Try Forge Mode</div>
            <div className="text-gray-500 mt-1">Advanced context building</div>
          </Link>
        </div>
      </div>
    </div>
  );
}