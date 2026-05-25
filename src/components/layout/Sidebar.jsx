import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, TreePine, UserCheck, ClipboardList, Menu, X, Coffee, Settings2, Sprout, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
{ path: '/', label: 'Dashboard', icon: LayoutDashboard },
{ path: '/produtores', label: 'Produtores', icon: Users },
{ path: '/talhoes', label: 'Talhões', icon: TreePine },
{ path: '/safristas', label: 'Safristas', icon: UserCheck },
{ path: '/lancamentos', label: 'Lançamentos', icon: ClipboardList },
{ path: '/parametros', label: 'Parâmetros e Talhões', icon: Settings2 },
{ path: '/adubacao', label: 'Adubação do Cafeeiro', icon: Sprout },
{ path: '/fertilizantes', label: 'Base de Fertilizantes', icon: FlaskConical }];


export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-md"
        onClick={() => setOpen(!open)}>
        
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Overlay */}
      {open &&
      <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />
      }

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground z-40
        flex flex-col transition-transform duration-300
        lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-sidebar-primary-foreground">
                {/* tronco */}
                <line x1="12" y1="22" x2="12" y2="12" />
                {/* galho esquerdo */}
                <path d="M12 17 C9 16, 6 14, 5 11" />
                {/* galho direito */}
                <path d="M12 15 C15 14, 18 12, 19 9" />
                {/* folha esquerda */}
                <path d="M5 11 C3 8, 5 5, 8 7 C7 9, 6 11, 5 11Z" fill="currentColor" stroke="none" />
                {/* folha direita */}
                <path d="M19 9 C21 6, 19 3, 16 5 C17 7, 18 9, 19 9Z" fill="currentColor" stroke="none" />
                {/* fruto no galho esq */}
                <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
                {/* fruto no galho dir */}
                <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Café </h1>
              <p className="text-xs text-sidebar-foreground/60">Planejamento de Café</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${isActive ?
                'bg-sidebar-accent text-sidebar-primary' :
                'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
                `
                }>
                
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>);

          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 text-center">
            Safra 2025/2026
          </p>
        </div>
      </aside>
    </>);

}