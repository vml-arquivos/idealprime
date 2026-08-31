import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

// Páginas públicas
import Marketplace from "./pages/Marketplace";
import QuaseZero from "./pages/QuaseZero";
import ProductPage from "./pages/ProductPage";
import Login from "./pages/Login";
import PricingSimulator from "./pages/PricingSimulator";
import WishlistPublic from "./pages/WishlistPublic";

// Páginas protegidas
import Dashboard from "./pages/Dashboard";
import WishlistAdmin from "./pages/WishlistAdmin";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import SimulationsExport from "./pages/SimulationsExport";
import SimulationDetail from "./pages/SimulationDetail";
import BatchPricing from "./pages/BatchPricing";
import Estoque from "./pages/Estoque";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import ConfiguracoesPagamento from "./pages/ConfiguracoesPagamento";
import Relatorios from "./pages/Relatorios";
import Pedidos from "./pages/Pedidos";
import CategoriasAdmin from "./pages/CategoriasAdmin";
import Vendedores from "./pages/Vendedores";
import VendaDireta from "./pages/VendaDireta";
import SejaVendedor from "./pages/SejaVendedor";
import Loja from "./pages/Loja";
import MinhaConta from "./pages/MinhaConta";
import BusinessSignup from "./pages/BusinessSignup";
import BusinessPortal from "./pages/BusinessPortal";
import B2BAdmin from "./pages/B2BAdmin";

// Cotação de preços
import Cotacoes from "./pages/Cotacoes";
import CotacoesGestao from "./pages/CotacoesGestao";
import CotacaoSessaoForm from "./pages/CotacaoSessaoForm";
import CotacaoColeta from "./pages/CotacaoColeta";
import CotacaoComparativo from "./pages/CotacaoComparativo";
import CotacaoLocais from "./pages/CotacaoLocais";

// PL = Protected + Layout (para páginas sem DashboardLayout interno)
const PL = ({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) => (
  <ProtectedRoute adminOnly={adminOnly}>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

// P = Protected only (para páginas que já têm DashboardLayout interno)
const P = ({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) => <ProtectedRoute adminOnly={adminOnly}>{children}</ProtectedRoute>;

function Router() {
  return (
    <Switch>
      {/* ── PÚBLICAS ──────────────────────────────────────────────────── */}
      <Route path="/" component={Marketplace} />
      <Route path="/vitrine" component={Marketplace} />
      <Route path="/quase-zero" component={QuaseZero} />
      <Route path="/vitrine/:id" component={ProductPage} />
      <Route path="/login" component={Login} />
      <Route path="/empresa/cadastro" component={BusinessSignup} />
      <Route path="/portal" component={BusinessPortal} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/desejos" component={WishlistPublic} />
      <Route path="/vendedor/:token" component={VendaDireta} />
      <Route path="/seja-vendedor" component={SejaVendedor} />
      <Route path="/loja/:referralCode" component={Loja} />
      <Route path="/minha-conta" component={MinhaConta} />

      <Route path="/b2b-admin">{() => (<PL><B2BAdmin /></PL>)}</Route>

      {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
      <Route path="/dashboard">
        {() => (
          <PL>
            <Dashboard />
          </PL>
        )}
      </Route>

      {/* ── PRODUTOS ──────────────────────────────────────────────────── */}
      <Route path="/produtos">
        {() => (
          <PL>
            <Products />
          </PL>
        )}
      </Route>
      {/* ProductForm já inclui DashboardLayout internamente — usar P para evitar duplicação */}
      <Route path="/produtos/novo">
        {() => (
          <P>
            <ProductForm />
          </P>
        )}
      </Route>
      <Route path="/produtos/:id/editar">
        {() => (
          <P>
            <ProductForm />
          </P>
        )}
      </Route>

      {/* ── ESTOQUE ───────────────────────────────────────────────────── */}
      <Route path="/estoque">
        {() => (
          <P>
            <Estoque />
          </P>
        )}
      </Route>

      {/* ── SIMULAÇÕES ────────────────────────────────────────────────── */}
      <Route path="/simulacoes">
        {() => (
          <P>
            <SimulationsExport />
          </P>
        )}
      </Route>
      <Route path="/simulacoes/:id">
        {(params: any) => (
          <PL>
            <SimulationDetail id={Number(params.id)} />
          </PL>
        )}
      </Route>

      {/* ── ENTRADA DE PRODUTOS ─────────────────────────────────────── */}
      <Route path="/entrada-produtos">
        {() => (
          <PL>
            <BatchPricing />
          </PL>
        )}
      </Route>
      <Route path="/entrada-produtos/novo">
        {() => (
          <PL>
            <BatchPricing />
          </PL>
        )}
      </Route>

      {/* Rotas antigas mantidas por compatibilidade */}
      <Route path="/lotes">
        {() => (
          <PL>
            <BatchPricing />
          </PL>
        )}
      </Route>
      <Route path="/lotes/novo">
        {() => (
          <PL>
            <BatchPricing />
          </PL>
        )}
      </Route>

      {/* ── RELATÓRIOS ────────────────────────────────────────────────── */}
      <Route path="/relatorios">
        {() => (
          <P>
            <Relatorios />
          </P>
        )}
      </Route>

      {/* ── LISTA DE DESEJOS ADMIN ────────────────────────────────────── */}
      <Route path="/desejos-admin">
        {() => (
          <P>
            <WishlistAdmin />
          </P>
        )}
      </Route>

      {/* ── PEDIDOS ───────────────────────────────────────────────────── */}
      <Route path="/pedidos">
        {() => (
          <PL>
            <Pedidos />
          </PL>
        )}
      </Route>

      {/* ── SOMENTE ADMIN ─────────────────────────────────────────────── */}
      <Route path="/usuarios">
        {() => (
          <P adminOnly>
            <Usuarios />
          </P>
        )}
      </Route>
      <Route path="/categorias">
        {() => (
          <P adminOnly>
            <CategoriasAdmin />
          </P>
        )}
      </Route>
      <Route path="/vendedores">
        {() => (
          <P adminOnly>
            <Vendedores />
          </P>
        )}
      </Route>
      <Route path="/configuracoes">
        {() => (
          <P>
            <Configuracoes />
          </P>
        )}
      </Route>
      <Route path="/configuracoes-pagamento">
        {() => (
          <P>
            <ConfiguracoesPagamento />
          </P>
        )}
      </Route>

      {/* ── COTAÇÃO DE PREÇOS (layout próprio mobile-first) ─────────── */}
      <Route path="/cotacoes">
        {() => (
          <ProtectedRoute>
            <Cotacoes />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes-gestao">
        {() => (
          <P>
            <CotacoesGestao />
          </P>
        )}
      </Route>
      <Route path="/cotacoes/nova">
        {() => (
          <ProtectedRoute>
            <CotacaoSessaoForm />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/locais">
        {() => (
          <ProtectedRoute>
            <CotacaoLocais />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/editar">
        {() => (
          <ProtectedRoute>
            <CotacaoSessaoForm />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/coletar">
        {() => (
          <ProtectedRoute>
            <CotacaoColeta />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/comparativo">
        {() => (
          <ProtectedRoute>
            <CotacaoComparativo />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
