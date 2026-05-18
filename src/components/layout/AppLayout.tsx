import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '../CommandPalette';
import { Menu, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[4px] md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="h-14 flex-shrink-0 sticky top-0 z-30 flex items-center px-4 md:px-6 border-b border-border bg-[rgba(10,10,10,0.8)] backdrop-blur-[12px]">
          <div className="flex-1 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMobileOpen(true)}
                className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-elevated rounded-full md:hidden transition-colors active:scale-95"
                title="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-sm font-display font-semibold tracking-tight text-text-primary">
                {/* Dynamically show page title on mobile if needed */}
                <span className="md:hidden">ZangSends</span>
                <span className="hidden md:block uppercase tracking-wider text-text-secondary text-xs">ZangSends</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-text-secondary md:hidden">
                <Search className="w-5 h-5" />
              </button>
              <div className="text-xs text-text-tertiary hidden md:block px-3 py-1 bg-elevated rounded-full border border-border">
                <span className="opacity-50">⌘</span>K to search
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
    </div>
  );
}
