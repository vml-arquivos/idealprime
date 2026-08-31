import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
const logo = "/brand/ideal-prime-logo.jpg";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Obter o redirect da URL
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <img src={logo} alt="Ideal Prime" className="h-20 w-auto object-contain mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight">
            Ideal Prime
          </h1>
          <p className="text-sm text-muted-foreground">
            Faça login para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error */}
          {error && (
            <div className="flex gap-3 p-3 rounded-lg bg-danger/10 border border-danger/30">
              <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={isLoading}
              className="h-10"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="h-10"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 mt-6"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center">
          Ver catálogo em{" "}
          <button onClick={() => setLocation("/")} className="text-primary hover:underline font-medium">
            Vitrine
          </button>
          {" · "}
          Simulador em{" "}
          <button onClick={() => setLocation("/simulador")} className="text-primary hover:underline font-medium">
            /simulador
          </button>
        </p>
      </div>
    </div>
  );
}
