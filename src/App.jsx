import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Produtores from './pages/Produtores';
import Talhoes from './pages/Talhoes';
import Safristas from './pages/Safristas';
import Lancamentos from './pages/Lancamentos';
import ParametrosTalhoes from './pages/ParametrosTalhoes';
import Adubacao from './pages/Adubacao';
import BaseFertilizantes from './pages/BaseFertilizantes';
import AplicacoesFoliares from './pages/AplicacoesFoliares';
import Calendario from './pages/Calendario';
import Adubacao2 from './pages/Adubacao2';
import Planejamento from './pages/Planejamento';
import NotasFiscais from './pages/NotasFiscais';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/produtores" element={<Produtores />} />
        <Route path="/talhoes" element={<Talhoes />} />
        <Route path="/safristas" element={<Safristas />} />
        <Route path="/lancamentos" element={<Lancamentos />} />
        <Route path="/parametros" element={<ParametrosTalhoes />} />
        <Route path="/adubacao" element={<Adubacao />} />
        <Route path="/fertilizantes" element={<BaseFertilizantes />} />
        <Route path="/foliar" element={<AplicacoesFoliares />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/adubacao2" element={<Adubacao2 />} />
        <Route path="/planejamento" element={<Planejamento />} />
        <Route path="/notas-fiscais" element={<NotasFiscais />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App