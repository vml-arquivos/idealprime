import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, UserCheck, Plus, Pencil, Trash2, Save, X, KeyRound } from "lucide-react";
import { toast } from "sonner";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  active: boolean;
  createdAt?: string | Date;
  lastSignedIn?: string | Date;
};

const emptyNewUser = {
  name: "",
  email: "",
  password: "",
  role: "user" as "user" | "admin",
};

export default function Usuarios() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: users = [], isLoading, refetch } = trpc.admin.listUsers.useQuery();

  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "user" as "user" | "admin",
    active: true,
    newPassword: "",
  });

  const stats = useMemo(() => {
    const list = users as UserRow[];
    return {
      total: list.length,
      admins: list.filter((u) => u.role === "admin").length,
      active: list.filter((u) => u.active).length,
    };
  }, [users]);

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuário criado.");
      setNewUser(emptyNewUser);
      setCreating(false);
      await utils.admin.listUsers.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuário atualizado.");
      setEditingId(null);
      await utils.admin.listUsers.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuário apagado.");
      await utils.admin.listUsers.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const startEdit = (user: UserRow) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      newPassword: "",
    });
  };

  const handleCreate = () => {
    if (!newUser.name.trim()) return toast.error("Informe o nome.");
    if (!newUser.email.trim()) return toast.error("Informe o email.");
    if (newUser.password.length < 8) return toast.error("A senha precisa ter no mínimo 8 caracteres.");
    createUser.mutate(newUser);
  };

  const handleUpdate = (userId: number) => {
    if (!editForm.name.trim()) return toast.error("Informe o nome.");
    if (!editForm.email.trim()) return toast.error("Informe o email.");
    if (editForm.newPassword && editForm.newPassword.length < 8) {
      return toast.error("A nova senha precisa ter no mínimo 8 caracteres.");
    }
    updateUser.mutate({ userId, ...editForm });
  };

  const handleDelete = (user: UserRow) => {
    if ((me as any)?.id === user.id) {
      toast.error("Você não pode apagar sua própria conta.");
      return;
    }

    const ok = window.confirm(
      `Apagar usuário ${user.name}?\n\n` +
      `Email: ${user.email}\n\n` +
      `Essa ação remove o usuário do sistema. Produtos e registros vinculados serão desvinculados para evitar erro de banco.`
    );
    if (!ok) return;
    deleteUser.mutate({ userId: user.id });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
            <p className="text-muted-foreground text-sm">
              Administração suprema de usuários: criar, editar, ativar/desativar, trocar senha e apagar.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreating((v) => !v)}>
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? "Fechar" : "Novo usuário"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Usuário Atual</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="font-semibold">{(me as any)?.name}</div>
              <p className="text-xs text-muted-foreground">{(me as any)?.email}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Função</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <Badge variant={(me as any)?.role === "admin" ? "default" : "secondary"}>
                {(me as any)?.role === "admin" ? "Administrador" : "Usuário"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.active} ativo(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
              <p className="text-xs text-muted-foreground">com permissão total</p>
            </CardContent>
          </Card>
        </div>

        {creating && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" /> Novo usuário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nome"
                  value={newUser.name}
                  onChange={(e) => setNewUser((v) => ({ ...v, name: e.target.value }))}
                />
                <input
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((v) => ({ ...v, email: e.target.value }))}
                />
                <input
                  type="password"
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Senha inicial"
                  value={newUser.password}
                  onChange={(e) => setNewUser((v) => ({ ...v, password: e.target.value }))}
                />
                <select
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={newUser.role}
                  onChange={(e) => setNewUser((v) => ({ ...v, role: e.target.value as "user" | "admin" }))}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
                <Button onClick={handleCreate} disabled={createUser.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Todos os usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (users as UserRow[]).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            ) : (
              (users as UserRow[]).map((user) => {
                const isEditing = editingId === user.id;
                const isMe = (me as any)?.id === user.id;

                return (
                  <div key={user.id} className="rounded-xl border border-border bg-card p-4">
                    {!isEditing ? (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">#{user.id} — {user.name}</p>
                            {isMe && <Badge variant="secondary">Você</Badge>}
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role === "admin" ? "Admin" : "Usuário"}
                            </Badge>
                            <Badge variant="secondary" className={user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                              {user.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {user.createdAt ? new Date(user.createdAt).toLocaleString("pt-BR") : "—"} · Último acesso {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "—"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => startEdit(user)}>
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-destructive hover:text-destructive"
                            disabled={isMe || deleteUser.isPending}
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="h-4 w-4" /> Apagar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.name}
                            onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.email}
                            onChange={(e) => setEditForm((v) => ({ ...v, email: e.target.value }))}
                          />
                          <select
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.role}
                            disabled={isMe}
                            onChange={(e) => setEditForm((v) => ({ ...v, role: e.target.value as "user" | "admin" }))}
                          >
                            <option value="user">Usuário</option>
                            <option value="admin">Administrador</option>
                          </select>
                          <select
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.active ? "true" : "false"}
                            disabled={isMe}
                            onChange={(e) => setEditForm((v) => ({ ...v, active: e.target.value === "true" }))}
                          >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                          </select>
                          <input
                            type="password"
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Nova senha opcional"
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm((v) => ({ ...v, newPassword: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5" /> Deixe a senha vazia para manter a senha atual.
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="gap-2" disabled={updateUser.isPending} onClick={() => handleUpdate(user.id)}>
                              <Save className="h-4 w-4" /> Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
