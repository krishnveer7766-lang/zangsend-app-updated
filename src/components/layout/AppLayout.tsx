import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '../CommandPalette';
import { Menu } from 'lucide-react';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[4px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex-shrink-0 sticky top-0 z-10 flex items-center px-4 md:px-6 border-b border-border bg-[rgba(10,10,10,0.8)] backdrop-blur-[12px]">
          {/* Top Bar Content */}
          <div className="flex-1 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* Hamburger Button on Mobile */}
              <button 
                onClick={() => setMobileOpen(true)}
                className="p-1.5 -ml-1 text-text-secondary hover:text-text-primary hover:bg-elevated rounded-md md:hidden transition-colors"
                title="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-sm text-text-secondary font-medium tracking-wide uppercase">
                ZangSends
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs text-text-tertiary hidden sm:block">⌘K to search</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto relative">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
