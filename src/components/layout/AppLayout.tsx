import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNavbar } from './MobileNavbar';
import { CommandPalette } from '../CommandPalette';
import { Menu, Search, Zap } from 'lucide-react';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Track scroll for header effects
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar mobileOpen={false} setMobileOpen={() => {}} />
      </div>
      
      {/* Mobile Drawer Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className={`h-14 flex-shrink-0 sticky top-0 z-30 flex items-center px-4 
          transition-all duration-300 ease-out md:hidden safe-area-top
          ${isScrolled 
            ? 'bg-background/95 backdrop-blur-xl border-b border-border shadow-lg shadow-black/20' 
            : 'bg-transparent'
          }`}
        >
          <div className="flex-1 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMobileOpen(true)}
                className="p-2.5 -ml-2 text-text-secondary hover:text-text-primary 
                         hover:bg-elevated rounded-xl transition-all duration-200
                         active:scale-95 touch-manipulation"
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="font-display font-semibold text-text-primary tracking-tight">
                  ZangSends
                </span>
              </div>
            </div>
            <button 
              className="p-2.5 text-text-secondary hover:text-text-primary 
                       hover:bg-elevated rounded-xl transition-all duration-200
                       active:scale-95 touch-manipulation"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="h-12 flex-shrink-0 sticky top-0 z-10 hidden md:flex items-center px-6 border-b border-border bg-[rgba(10,10,10,0.8)] backdrop-blur-[12px]">
          <div className="flex-1 flex justify-between items-center">
            <div className="text-sm text-text-secondary font-medium tracking-wide uppercase">
              ZangSends
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs text-text-tertiary">Press ⌘K to search</div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative pb-20 md:pb-0">
          <div className="fade-in">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNavbar />
      </div>
      <CommandPalette />
    </div>
  );
}
