import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

interface NavLinkProps {
  to: string;
  label: string;
  badge?: number;
}

function NavLink({ to, label, badge }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function LeftNav() {
  const { state } = useAppContext();

  return (
    <aside className="bg-white border-r border-gray-200 p-3 flex flex-col gap-2">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Builder</h3>
      
      <nav className="flex flex-col gap-1">
        <NavLink to="/providers" label="Providers" badge={state.counts.providers} />
        <NavLink to="/models" label="Models" badge={state.counts.models} />
        <NavLink to="/characters" label="Characters" badge={state.counts.characters} />
        <NavLink to="/profiles" label="User Profiles" badge={state.counts.profiles} />
        <NavLink to="/presets" label="Presets" badge={state.counts.presets} />
        <NavLink to="/templates" label="Templates" badge={state.counts.templates} />
        
        <div className="border-t border-gray-200 my-2"></div>
        
        <NavLink to="/rules" label="Context Rules" badge={state.counts.rules} />
        <NavLink to="/forge" label="Forge Mode" />
      </nav>
    </aside>
  );
}