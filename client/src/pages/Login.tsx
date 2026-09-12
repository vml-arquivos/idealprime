import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Building2, ShieldCheck, UserCog } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get("redirect") || "/dashboard";
      setLocation(redirect, { replace: true });
    },
    onError: (err) => {
      setError(err.message || "Erro ao fazer login");
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim()) {
      setError("Email é obrigatório");
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("Senha é obrigatória");
      setIsLoading(false);
      return;
    }

    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        password: password.trim(),
      });
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
      setIsLoading(false);
    }
  };

  return (
    <div className="prime-soft-surface flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#D5E8E0] bg-white shadow-[0_24px_80px_rgba(12,69,54,0.12)] lg:grid-cols-[0.94fr_1.06fr]">
        <aside className="prime-pattern-surface relative overflow-hidden px-6 py-10 text-white sm:px-10 lg:px-12">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/20" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="relative">
            <BrandLogo variant="white" className="w-[190px]" />
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B9F1D4]">
              Acesso Ideal Prime
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Entrada organizada para empresa e equipe.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
              Utilize esta área para entrar com seu usuário. Empresas acessam o portal comercial e a equipe interna acessa o painel operacional.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Portal da empresa</p>
                    <p className="text-xs text-white/70">Catálogo B2B, cotações e pedidos</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/portal">
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0C4536] transition hover:bg-[#E8F7F1]">
                      Entrar no portal <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                  <Link href="/empresa/cadastro">
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                      Solicitar cadastro
                    </span>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Equipe interna</p>
                    <p className="text-xs text-white/70">Dashboard, produtos, estoque e financeiro</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-white/70">
                  <ShieldCheck className="h-4 w-4" />
                  Faça login com suas credenciais para acessar o sistema.
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#068A5B]">
                Área de login
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-[#0C4536]">
                Entrar no sistema
              </h2>
              <p className="text-sm text-[#6C8278]">
                Informe email e senha para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="flex gap-3 rounded-2xl border border-[#F3C7C2] bg-[#FFF3F1] p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#B42318]" />
                  <p className="text-sm text-[#B42318]">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-[#12352B]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                  className="h-11 rounded-xl border-[#D5E8E0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-[#12352B]">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="h-11 rounded-xl border-[#D5E8E0]"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-6 h-11 w-full rounded-xl bg-[#068A5B] text-white hover:bg-[#0C4536]"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-[#E1ECE7] bg-[#F7FBF9] p-4 text-sm text-[#5E776D]">
              <p className="font-medium text-[#12352B]">Acesso rápido</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <button onClick={() => setLocation("/")} className="font-semibold text-[#068A5B] hover:underline">
                  Vitrine pública
                </button>
                <button onClick={() => setLocation("/portal")} className="font-semibold text-[#068A5B] hover:underline">
                  Portal da empresa
                </button>
                <button onClick={() => setLocation("/simulador")} className="font-semibold text-[#068A5B] hover:underline">
                  Simulador
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
