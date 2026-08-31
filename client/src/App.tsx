import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import { PERMISSIONS, type PermissionKey } from "@shared/permissions";

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
  permission,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: PermissionKey;
}) => (
  <ProtectedRoute adminOnly={adminOnly} permission={permission}>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

// P = Protected only (para páginas que já têm DashboardLayout interno)
const P = ({
  children,
  adminOnly = false,
  permission,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: PermissionKey;
}) => <ProtectedRoute adminOnly={adminOnly} permission={permission}>{children}</ProtectedRoute>;

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

      <Route path="/b2b-admin">{() => (<PL permission={PERMISSIONS.B2B_OPERATIONS}><B2BAdmin /></PL>)}</Route>

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
          <PL permission={PERMISSIONS.PRODUCTS}>
            <Products />
          </PL>
        )}
      </Route>
      {/* ProductForm já inclui DashboardLayout internamente — usar P para evitar duplicação */}
      <Route path="/produtos/novo">
        {() => (
          <P permission={PERMISSIONS.PRODUCTS}>
            <ProductForm />
          </P>
        )}
      </Route>
      <Route path="/produtos/:id/editar">
        {() => (
          <P permission={PERMISSIONS.PRODUCTS}>
            <ProductForm />
          </P>
        )}
      </Route>

      {/* ── ESTOQUE ───────────────────────────────────────────────────── */}
      <Route path="/estoque">
        {() => (
          <P permission={PERMISSIONS.INVENTORY}>
            <Estoque />
          </P>
        )}
      </Route>

      {/* ── SIMULAÇÕES ────────────────────────────────────────────────── */}
      <Route path="/simulacoes">
        {() => (
          <P permission={PERMISSIONS.PRICING}>
            <SimulationsExport />
          </P>
        )}
      </Route>
      <Route path="/simulacoes/:id">
        {(params: any) => (
          <PL permission={PERMISSIONS.PRICING}>
            <SimulationDetail id={Number(params.id)} />
          </PL>
        )}
      </Route>

      {/* ── ENTRADA DE PRODUTOS ─────────────────────────────────────── */}
      <Route path="/entrada-produtos">
        {() => (
          <PL permission={PERMISSIONS.INVENTORY}>
            <BatchPricing />
          </PL>
        )}
      </Route>
      <Route path="/entrada-produtos/novo">
        {() => (
          <PL permission={PERMISSIONS.INVENTORY}>
            <BatchPricing />
          </PL>
        )}
      </Route>

      {/* Rotas antigas mantidas por compatibilidade */}
      <Route path="/lotes">
        {() => (
          <PL permission={PERMISSIONS.INVENTORY}>
            <BatchPricing />
          </PL>
        )}
      </Route>
      <Route path="/lotes/novo">
        {() => (
          <PL permission={PERMISSIONS.INVENTORY}>
            <BatchPricing />
          </PL>
        )}
      </Route>

      {/* ── RELATÓRIOS ────────────────────────────────────────────────── */}
      <Route path="/relatorios">
        {() => (
          <P permission={PERMISSIONS.REPORTS}>
            <Relatorios />
          </P>
        )}
      </Route>

      {/* ── LISTA DE DESEJOS ADMIN ────────────────────────────────────── */}
      <Route path="/desejos-admin">
        {() => (
          <P permission={PERMISSIONS.SALES}>
            <WishlistAdmin />
          </P>
        )}
      </Route>

      {/* ── PEDIDOS ───────────────────────────────────────────────────── */}
      <Route path="/pedidos">
        {() => (
          <PL permission={PERMISSIONS.SALES}>
            <Pedidos />
          </PL>
        )}
      </Route>

      {/* ── SOMENTE ADMIN ─────────────────────────────────────────────── */}
      <Route path="/usuarios">
        {() => (
          <P adminOnly permission={PERMISSIONS.USERS}>
            <Usuarios />
          </P>
        )}
      </Route>
      <Route path="/categorias">
        {() => (
          <P adminOnly permission={PERMISSIONS.SETTINGS}>
            <CategoriasAdmin />
          </P>
        )}
      </Route>
      <Route path="/vendedores">
        {() => (
          <P adminOnly permission={PERMISSIONS.USERS}>
            <Vendedores />
          </P>
        )}
      </Route>
      <Route path="/configuracoes">
        {() => (
          <P permission={PERMISSIONS.SETTINGS}>
            <Configuracoes />
          </P>
        )}
      </Route>
      <Route path="/configuracoes-pagamento">
        {() => (
          <P permission={PERMISSIONS.SETTINGS}>
            <ConfiguracoesPagamento />
          </P>
        )}
      </Route>

      {/* ── COTAÇÃO DE PREÇOS (layout próprio mobile-first) ─────────── */}
      <Route path="/cotacoes">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
            <Cotacoes />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes-gestao">
        {() => (
          <P permission={PERMISSIONS.PRICING}>
            <CotacoesGestao />
          </P>
        )}
      </Route>
      <Route path="/cotacoes/nova">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
            <CotacaoSessaoForm />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/locais">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
            <CotacaoLocais />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/editar">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
            <CotacaoSessaoForm />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/coletar">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
            <CotacaoColeta />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/cotacoes/:id/comparativo">
        {() => (
          <ProtectedRoute permission={PERMISSIONS.PRICING}>
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
