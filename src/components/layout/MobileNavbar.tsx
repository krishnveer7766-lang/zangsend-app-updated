import { NavLink, useLocation } from 'react-router-dom';
import { Users, FileText, Clock, BarChart2, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Lists', icon: Users, path: '/lists' },
  { label: 'Templates', icon: FileText, path: '/templates' },
  { label: 'Scheduled', icon: Clock, path: '/scheduled' },
  { label: 'Stats', icon: BarChart2, path: '/statistics' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function MobileNavbar() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-area-bottom">
      {/* Gradient overlay for seamless blend */}
      <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      
      {/* Navigation bar */}
      <div className="bg-surface/95 backdrop-blur-xl border-t border-border/50 px-2 py-1">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center py-2 px-3 min-w-[60px]
                         transition-all duration-200 touch-manipulation"
              >
                {/* Active indicator pill */}
                <div className={`absolute -top-1 w-8 h-1 rounded-full transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary scale-100 opacity-100' 
                    : 'bg-transparent scale-0 opacity-0'
                }`} />
                
                {/* Icon container with animation */}
                <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary/10 text-primary scale-110' 
                    : 'text-text-tertiary active:text-text-secondary active:scale-95'
                }`}>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  
                  {/* Glow effect for active */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md -z-10" />
                  )}
                </div>
                
                {/* Label */}
                <span className={`text-[10px] font-medium mt-1 transition-all duration-300 ${
                  isActive ? 'text-primary' : 'text-text-tertiary'
                }`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
