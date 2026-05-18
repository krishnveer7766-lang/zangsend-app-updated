import { NavLink } from 'react-router-dom';
import { Users, FileText, BarChart2, Settings, History } from 'lucide-react';
import { motion } from 'framer-motion';

const ITEMS = [
  { label: 'Lists', icon: Users, path: '/lists' },
  { label: 'Templates', icon: FileText, path: '/templates' },
  { label: 'Stats', icon: BarChart2, path: '/statistics' },
  { label: 'History', icon: History, path: '/history' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-lg border-t border-border md:hidden px-2 pb-safe">
      <div className="flex justify-around items-center h-16">
        {ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 mb-1 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-[1px] left-1/4 right-1/4 h-[2px] bg-primary rounded-full shadow-[0_0_8px_var(--green-glow)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
