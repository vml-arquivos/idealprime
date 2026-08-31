/**
 * CategoriasAdmin.tsx — Gerenciamento de Categorias
 * /categorias (admin)
 *
 * CRUD completo: listar, criar, editar inline, ativar/desativar, deletar.
 * Categorias são usadas na Lista de Desejos e no catálogo de produtos.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Loader2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
  active: boolean;
  createdAt: string | Date;
}

const EMOJI_SUGGESTIONS = ["📱", "💻", "🌸", "📦", "👗", "🏠", "🎮", "⌚", "📷", "🎧", "👟", "💄"];

const emptyForm = { slug: "", label: "", emoji: "📦", sortOrder: 0, active: true };

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CategoriasAdmin() {
  const utils = trpc.useUtils();

  // Queries
  const { data: categories = [], isLoading } = trpc.categories.list.useQuery({ onlyActive: false });

  // Mutations
  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Categoria criada com sucesso!");
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Categoria atualizada!");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Categoria removida.");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // Estado do formulário
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      slug: cat.slug,
      label: cat.label,
      emoji: cat.emoji,
      sortOrder: cat.sortOrder,
      active: cat.active,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    // Valida
    if (!form.label.trim() || form.label.trim().length < 2) {
      toast.error("O nome da categoria precisa ter ao menos 2 caracteres.");
      return;
    }
    if (!form.slug.trim() || form.slug.trim().length < 2) {
      toast.error("O slug precisa ter ao menos 2 caracteres.");
      return;
    }

    const payload = {
      ...form,
      slug: form.slug.toUpperCase().replace(/\s+/g, "_"),
      label: form.label.trim(),
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleActive(cat: Category) {
    updateMutation.mutate({ id: cat.id, active: !cat.active });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="w-6 h-6" /> Categorias
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie as categorias usadas na Lista de Desejos e no catálogo
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Categoria
          </Button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando categorias...
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border bg-muted/20 p-12 text-center space-y-3">
            <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Nenhuma categoria cadastrada.</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Criar primeira categoria
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y">
            {(categories as Category[])
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
              .map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors ${!cat.active ? "opacity-50" : ""}`}
                >
                  {/* Drag handle visual */}
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

                  {/* Emoji */}
                  <span className="text-2xl shrink-0 w-8 text-center">{cat.emoji}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{cat.label}</span>
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {cat.slug}
                      </code>
                      {!cat.active && (
                        <Badge variant="secondary" className="text-xs">Inativa</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ordem: {cat.sortOrder}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={cat.active ? "Desativar" : "Ativar"}
                      onClick={() => toggleActive(cat)}
                    >
                      {cat.active
                        ? <ToggleRight className="w-4 h-4 text-green-600" />
                        : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar"
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir"
                      onClick={() => setDeleteId(cat.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Dialog criar/editar ────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!isSaving) { setDialogOpen(v); if (!v) setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={`text-2xl p-1.5 rounded-lg border-2 transition-colors ${form.emoji === e ? "border-primary bg-primary/10" : "border-transparent hover:border-muted-foreground/30"}`}
                  >
                    {e}
                  </button>
                ))}
                <Input
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  className="w-16 text-center text-xl"
                  maxLength={4}
                  title="Ou digite qualquer emoji"
                />
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-label">Nome da categoria *</Label>
              <Input
                id="cat-label"
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label,
                    // Auto-preenche slug se ainda não foi editado
                    slug: editing ? f.slug : label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, ""),
                  }));
                }}
                placeholder="Ex: Celulares"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">
                Slug <span className="text-muted-foreground font-normal">(identificador interno)</span>
              </Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    slug: e.target.value.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, ""),
                  }))
                }
                placeholder="Ex: CELULAR"
              />
              <p className="text-xs text-muted-foreground">Apenas letras maiúsculas, números e _</p>
            </div>

            {/* Ordem */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-order">Ordem de exibição</Label>
              <Input
                id="cat-order"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">Menor número = aparece primeiro</p>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className="flex items-center gap-2 text-sm"
              >
                {form.active
                  ? <ToggleRight className="w-6 h-6 text-green-600" />
                  : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                <span>{form.active ? "Ativa" : "Inativa"}</span>
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão ───────────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Pedidos existentes que usam esta categoria não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
