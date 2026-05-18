import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, FileText, History, Settings, HelpCircle, ChevronLeft, ChevronRight, Zap, Clock, Paperclip, BarChart2, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Lists', icon: Users, path: '/lists' },
  { label: 'Templates', icon: FileText, path: '/templates' },
  { label: 'Attachments', icon: Paperclip, path: '/attachments' },
  { label: 'Scheduled', icon: Clock, path: '/scheduled' },
  { label: 'Statistics', icon: BarChart2, path: '/statistics' },
  { label: 'History', icon: History, path: '/history' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleItemClick = () => {
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const isMobile = mobileOpen !== undefined && setMobileOpen !== undefined;

  return (
    <aside 
      className={`flex flex-col border-r border-border bg-[#0d0d0d] h-full transition-all duration-300 ease-out
        ${isMobile && mobileOpen ? 'w-[280px] slide-in-right' : ''}
        ${!isMobile ? (collapsed ? 'w-[56px]' : 'w-[220px]') : 'w-[280px]'}
      `}
    >
      {/* Header */}
      <div className="h-14 md:h-12 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center">
          <div className={`w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center
                        transition-all duration-300 ${collapsed && !mobileOpen ? '' : 'mr-3'}`}>
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="font-display font-semibold text-text-primary tracking-tight text-lg fade-in">
              ZangSends
            </span>
          )}
        </div>
        
        {/* Mobile close button */}
        {mobileOpen && (
          <button 
            onClick={() => setMobileOpen?.(false)}
            className="p-2 -mr-2 text-text-tertiary hover:text-text-primary 
                     rounded-xl transition-all duration-200 active:scale-95 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto stagger-children">
        {NAV_ITEMS.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleItemClick}
            style={{ animationDelay: `${index * 50}ms` }}
            className={({ isActive }) =>
              `flex items-center h-11 px-3 rounded-xl transition-all duration-200 group
               touch-manipulation active:scale-[0.98]
              ${isActive 
                ? 'bg-primary/10 text-primary shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-elevated'
              } ${(collapsed && !mobileOpen) ? 'justify-center px-0' : ''}`
            }
            title={(collapsed && !mobileOpen) ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <div className={`relative ${(collapsed && !mobileOpen) ? '' : 'mr-3'}`}>
                  <item.icon 
                    className={`w-5 h-5 flex-shrink-0 transition-all duration-200 
                              ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary/30 blur-md -z-10" />
                  )}
                </div>
                {(!collapsed || mobileOpen) && (
                  <span className={`text-sm font-medium transition-all duration-200
                                  ${isActive ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border mt-auto flex flex-col gap-1">
        <a 
          href="https://docs.zangsends.com" 
          target="_blank" 
          rel="noreferrer"
          onClick={handleItemClick}
          className={`flex items-center h-11 px-3 rounded-xl text-text-secondary 
                    hover:text-text-primary hover:bg-elevated transition-all duration-200
                    active:scale-[0.98] touch-manipulation
                    ${(collapsed && !mobileOpen) ? 'justify-center px-0' : ''}`}
          title={(collapsed && !mobileOpen) ? 'Help / Docs' : undefined}
        >
          <HelpCircle className={`w-5 h-5 flex-shrink-0 ${(collapsed && !mobileOpen) ? '' : 'mr-3'}`} />
          {(!collapsed || mobileOpen) && <span className="text-sm font-medium">Help / Docs</span>}
        </a>

        {/* Desktop collapse button */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={`items-center h-10 px-3 rounded-xl text-text-tertiary hover:text-text-primary 
                    hover:bg-elevated transition-all duration-200 mt-2 hidden md:flex
                    ${(collapsed && !mobileOpen) ? 'justify-center px-0' : ''}`}
        >
          <div className="relative">
            {(collapsed && !mobileOpen) ? (
              <ChevronRight className="w-5 h-5 transition-transform duration-300" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 transition-transform duration-300" />
                <span className="ml-3 text-xs uppercase tracking-[0.08em] font-medium">Collapse</span>
              </>
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}
