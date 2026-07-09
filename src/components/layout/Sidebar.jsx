import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, TreePine, UserCheck, ClipboardList,
  Menu, X, Leaf, Settings2, Sprout, FlaskConical, ChevronDown, ChevronRight, Wind, CalendarDays, BarChart3, Receipt } from
'lucide-react';
import { Button } from '@/components/ui/button';

const topItems = [
{ path: '/', label: 'Dashboard', icon: LayoutDashboard },
{ path: '/calendario', label: 'Calendário', icon: CalendarDays },
{ path: '/produtores', label: 'Produtores', icon: Users },
{ path: '/talhoes', label: 'Talhões', icon: TreePine }];


const colheitaItems = [
{ path: '/parametros', label: 'Parâmetros e Talhões', icon: Settings2 },
{ path: '/safristas', label: 'Safristas', icon: UserCheck },
{ path: '/lancamentos', label: 'Lançamentos', icon: ClipboardList }];


const bottomItems = [
{ path: '/adubacao', label: 'Adubação do Cafeeiro', icon: Sprout },
{ path: '/adubacao2', label: 'Adubação 2.0', icon: Sprout },
{ path: '/planejamento', label: 'Planejamento', icon: BarChart3 },
{ path: '/foliar', label: 'Aplicações Foliares', icon: Wind },
{ path: '/fertilizantes', label: 'Base de Insumos', icon: FlaskConical },
{ path: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt }];


function NavLink({ path, label, icon: Icon, indent, onClick, isActive }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
        ${indent ? 'ml-3' : ''}
        ${isActive ?
      'bg-sidebar-accent text-sidebar-primary' :
      'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
      `}>
      
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </Link>);

}

export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const colheitaActive = colheitaItems.some((i) => i.path === location.pathname);
  const [colheitaOpen, setColheitaOpen] = React.useState(colheitaActive);

  // Auto-open group if a child is active
  React.useEffect(() => {
    if (colheitaActive) setColheitaOpen(true);
  }, [location.pathname]);

  const close = () => setOpen(false);

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
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={close} />}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground z-40
        flex flex-col transition-transform duration-300
        lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="leading-tight text-xl font-bold">Gestão Coffee</h1>
              <p className="text-xs text-sidebar-foreground/60">Planejamento de Café</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pb-4 pl-4 pt-4 pr-4">
          {/* Itens do topo */}
          {topItems.map((item) =>
          <NavLink key={item.path} {...item} isActive={location.pathname === item.path} onClick={close} />
          )}

          {/* Seção Colheita — expansível */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setColheitaOpen((v) => !v)}
              className={`
                w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${colheitaActive ?
              'text-sidebar-primary bg-sidebar-accent/60' :
              'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
              `}>
              
              <span>Colheita</span>
              {colheitaOpen ?
              <ChevronDown className="w-4 h-4" /> :
              <ChevronRight className="w-4 h-4" />}
            </button>

            {colheitaOpen &&
            <div className="mt-1 space-y-0.5">
                {colheitaItems.map((item) =>
              <NavLink key={item.path} {...item} indent isActive={location.pathname === item.path} onClick={close} />
              )}
              </div>
            }
          </div>

          {/* Adubação */}
          <div className="pt-1 border-t border-sidebar-border mt-2">
            {bottomItems.map((item) =>
            <NavLink key={item.path} {...item} isActive={location.pathname === item.path} onClick={close} />
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 text-center">Safra 2025/2026</p>
        </div>
      </aside>
    </>);

}