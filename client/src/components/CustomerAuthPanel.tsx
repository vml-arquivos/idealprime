/**
 * client/src/components/CustomerAuthPanel.tsx
 *
 * Painel de login/criação de conta do CLIENTE final — com senha de verdade.
 * Usado em /minha-conta: é o "portão" que o cliente vê antes de acessar seus
 * dados, produtos e histórico de compras.
 *
 * Também cobre "ativação" de cadastros antigos: se o cliente já existia
 * (checkout rápido, cadastro interno) mas nunca teve senha, usar "Criar
 * conta" com o mesmo contato define a senha nesse cadastro existente — sem
 * duplicar registro e sem bloquear quem já comprou antes desta
 * funcionalidade existir.
 */
import { useState } from "react";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRememberedContact, rememberContact } from "@/lib/customerSession";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SafeCustomer = NonNullable<RouterOutputs["customerAuth"]["me"]>;

export function CustomerAuthPanel({
  onSuccess,
  title = "Entre ou crie sua conta",
  description = "Sua área do cliente guarda dados sigilosos (CPF, endereço, documentos e histórico de compras) — por isso é protegida por senha.",
  defaultContact,
}: {
  onSuccess: (customer: SafeCustomer) => void;
  title?: string;
  description?: string;
  defaultContact?: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [contact, setContact] = useState(
    defaultContact?.trim() || getRememberedContact()
  );
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const login = trpc.customerAuth.login.useMutation({
    onSuccess: result => {
      rememberContact(contact);
      toast.success(`Bem-vindo(a) de volta, ${result.customer.name.split(" ")[0]}!`);
      onSuccess(result.customer);
    },
    onError: error => toast.error(error.message),
  });

  const register = trpc.customerAuth.register.useMutation({
    onSuccess: result => {
      rememberContact(contact);
      toast.success("Conta criada com sucesso!");
      onSuccess(result.customer);
    },
    onError: error => toast.error(error.message),
  });

  const pending = login.isPending || register.isPending;

  const submitLogin = () => {
    if (contact.trim().length < 5) return toast.error("Informe seu WhatsApp ou e-mail.");
    if (!password) return toast.error("Informe sua senha.");
    login.mutate({ contact: contact.trim(), password });
  };

  const submitRegister = () => {
    if (name.trim().length < 2) return toast.error("Informe seu nome completo.");
    if (contact.trim().length < 8) return toast.error("Informe seu WhatsApp ou e-mail.");
    if (password.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    register.mutate({
      name: name.trim(),
      contact: contact.trim(),
      contactType: contact.includes("@") ? "EMAIL" : "WHATSAPP",
      password,
    });
  };

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900/5">
          <ShieldCheck className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={value => setMode(value as "login" | "register")}>
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="login" className="gap-2">
            <LogIn className="h-4 w-4" /> Entrar
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-2">
            <UserPlus className="h-4 w-4" /> Criar conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>WhatsApp ou e-mail</Label>
            <Input
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder="(00) 00000-0000 ou voce@email.com"
              onKeyDown={event => event.key === "Enter" && submitLogin()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              onKeyDown={event => event.key === "Enter" && submitLogin()}
            />
          </div>
          <Button className="w-full gap-2" onClick={submitLogin} disabled={pending}>
            <LogIn className="h-4 w-4" /> {login.isPending ? "Entrando…" : "Entrar"}
          </Button>
        </TabsContent>

        <TabsContent value="register" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={name} onChange={event => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp ou e-mail</Label>
            <Input
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder="(00) 00000-0000 ou voce@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Crie uma senha</Label>
            <Input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              onKeyDown={event => event.key === "Enter" && submitRegister()}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Já comprou com a gente antes? Use o mesmo WhatsApp/e-mail de sempre — sua conta
            existente é reconhecida automaticamente e só ganha uma senha nova.
          </p>
          <Button className="w-full gap-2" onClick={submitRegister} disabled={pending}>
            <UserPlus className="h-4 w-4" /> {register.isPending ? "Criando…" : "Criar minha conta"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
