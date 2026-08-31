/**
 * Configuracoes.tsx — Configurações do Sistema
 *
 * MUDANÇAS:
 * - Botão "Apagar" usuário com confirmação
 * - Mantidos: criar, ativar/desativar, alterar role, redefinir senha
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Settings,
  Database,
  Globe,
  Shield,
  Plus,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Crown,
  User,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <Crown className="w-3 h-3" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600">
      <User className="w-3 h-3" /> Usuário
    </span>
  );
}

function TabUsuarios({ currentUserId }: { currentUserId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "user" as "user" | "admin" });

  const usersQuery = trpc.admin.listUsers.useQuery();

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setShowForm(false);
      setForm({ email: "", name: "", password: "", role: "user" });
      usersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActiveMutation = trpc.admin.toggleUserActive.useMutation({
    onSuccess: (u) => {
      toast.success(u?.active ? "Usuário ativado" : "Usuário desativado");
      usersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { toast.success("Papel atualizado"); usersQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setResetTarget(null);
      setNewPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido permanentemente.");
      setDeleteTarget(null);
      usersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Confirmação de exclusão de usuário */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>"{deleteTarget?.name}"</strong> será removido
              definitivamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUserMutation.mutate({ userId: deleteTarget.id })}
            >
              Apagar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Gerenciar Usuários</h2>
          <p className="text-sm text-stone-500">{usersQuery.data?.length ?? 0} usuário(s) cadastrado(s)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="border border-stone-200 rounded-xl p-5 bg-stone-50 space-y-4">
          <h3 className="text-sm font-semibold text-stone-800">Criar novo usuário</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">E-mail *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Senha * (mín. 8 caracteres)</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha segura" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Papel</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "admin" })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white">
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.email || !form.name || form.password.length < 8} className="px-4 py-2 bg-stone-900 hover:bg-stone-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Criar Usuário
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-lg transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : (
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Último acesso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usersQuery.data?.map((u) => (
                <tr key={u.id} className={`hover:bg-stone-50 transition-colors ${!u.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-stone-900">{u.name}</p>
                      <p className="text-xs text-stone-400">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-xs text-stone-400 hidden md:table-cell">{fmtDate(u.lastSignedIn)}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />Ativo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3.5 h-3.5" />Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.id !== currentUserId && (
                        <button onClick={() => updateRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })} disabled={updateRoleMutation.isPending} title={u.role === "admin" ? "Remover admin" : "Tornar admin"} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Crown className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => { setResetTarget(u.id); setNewPassword(""); }} title="Redefinir senha" className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button onClick={() => toggleActiveMutation.mutate({ userId: u.id, active: !u.active })} disabled={toggleActiveMutation.isPending} title={u.active ? "Desativar" : "Ativar"} className={`p-1.5 rounded-lg transition-colors ${u.active ? "text-stone-400 hover:text-red-600 hover:bg-red-50" : "text-stone-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                          {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}
                      {u.id !== currentUserId && (
                        <button onClick={() => setDeleteTarget({ id: u.id, name: u.name })} title="Apagar usuário" className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal redefinir senha */}
      {resetTarget !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2"><KeyRound className="w-4 h-4" />Redefinir senha</h3>
            <p className="text-sm text-stone-500">Digite a nova senha para o usuário selecionado.</p>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => resetPasswordMutation.mutate({ userId: resetTarget, newPassword })} disabled={resetPasswordMutation.isPending || newPassword.length < 8} className="flex-1 py-2 bg-stone-900 hover:bg-stone-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                {resetPasswordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar
              </button>
              <button onClick={() => { setResetTarget(null); setNewPassword(""); }} className="flex-1 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-lg transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabSistema() {
  const systemQuery = trpc.system.status.useQuery();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Informações do Sistema</h2>
        <p className="text-sm text-stone-500">Status e configurações gerais</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-stone-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-stone-700"><Database className="w-4 h-4" /><span className="text-sm font-semibold">Banco de Dados</span></div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">PostgreSQL</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${systemQuery.data?.database?.connected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
              {systemQuery.data?.database?.connected ? <><CheckCircle2 className="w-3 h-3" />Conectado</> : <><XCircle className="w-3 h-3" />Desconectado</>}
            </span>
          </div>
        </div>
        <div className="border border-stone-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-stone-700"><Globe className="w-4 h-4" /><span className="text-sm font-semibold">Armazenamento</span></div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Upload de imagens</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${systemQuery.data?.storage?.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {systemQuery.data?.storage?.configured ? <><CheckCircle2 className="w-3 h-3" />Configurado</> : <><XCircle className="w-3 h-3" />Não configurado</>}
            </span>
          </div>
        </div>
        <div className="border border-stone-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-stone-700"><Shield className="w-4 h-4" /><span className="text-sm font-semibold">Segurança</span></div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Autenticação</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />JWT + Cookie</span>
            </div>
          </div>
        </div>
        <div className="border border-stone-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-stone-700"><Settings className="w-4 h-4" /><span className="text-sm font-semibold">Aplicação</span></div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Ambiente</span>
            <span className="text-stone-700 text-xs font-medium">{import.meta.env.MODE === "production" ? "Produção" : "Desenvolvimento"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabMinhaConta({ user }: { user: { id: number; name: string; email: string; role: string } }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ newPass: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const resetMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setShowPasswordForm(false);
      setPasswords({ newPass: "", confirm: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const handleChangePassword = () => {
    if (passwords.newPass !== passwords.confirm) { toast.error("As senhas não coincidem"); return; }
    if (passwords.newPass.length < 8) { toast.error("A nova senha deve ter ao menos 8 caracteres"); return; }
    resetMutation.mutate({ userId: user.id, newPassword: passwords.newPass });
  };
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Minha Conta</h2>
        <p className="text-sm text-stone-500">Informações do seu perfil</p>
      </div>
      <div className="border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center text-white font-bold text-lg">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <p className="font-semibold text-stone-900">{user.name}</p>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
          <div className="ml-auto"><RoleBadge role={user.role} /></div>
        </div>
      </div>
      <div className="border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-700"><KeyRound className="w-4 h-4" /><span className="text-sm font-semibold">Alterar Senha</span></div>
          <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-xs text-stone-500 hover:text-stone-900 underline transition-colors">{showPasswordForm ? "Cancelar" : "Alterar"}</button>
        </div>
        {showPasswordForm && (
          <div className="space-y-3 pt-1">
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={passwords.newPass} onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })} placeholder="Nova senha (mín. 8 caracteres)" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 pr-10" />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            <input type={showPwd ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Confirmar nova senha" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
            <button onClick={handleChangePassword} disabled={resetMutation.isPending || passwords.newPass.length < 8 || passwords.newPass !== passwords.confirm} className="w-full py-2 bg-stone-900 hover:bg-stone-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              {resetMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar nova senha
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState<"usuarios" | "sistema" | "conta">("usuarios");
  const meQuery = trpc.auth.me.useQuery();
  const user = meQuery.data;
  const isAdmin = user?.role === "admin";

  const tabs = [
    { id: "usuarios" as const, label: "Usuários", icon: Users, adminOnly: true },
    { id: "sistema" as const, label: "Sistema", icon: Database, adminOnly: true },
    { id: "conta" as const, label: "Minha Conta", icon: User, adminOnly: false },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Configurações</h1>
          <p className="text-sm text-stone-500">Gerencie usuários, sistema e sua conta</p>
        </div>
        <div className="border-b border-stone-200">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              if (tab.adminOnly && !isAdmin) return null;
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"}`}>
                  <Icon className="w-4 h-4" />{tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div>
          {activeTab === "usuarios" && isAdmin && user && <TabUsuarios currentUserId={user.id} />}
          {activeTab === "sistema" && isAdmin && <TabSistema />}
          {activeTab === "conta" && user && <TabMinhaConta user={user} />}
          {!isAdmin && activeTab !== "conta" && (
            <div className="text-center py-12 text-stone-400">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Apenas administradores têm acesso a esta seção.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
