/**
 * Clientes.tsx — Ficha de clientes (equipe) /clientes
 *
 * Relação unificada de clientes pessoa física (cadastro de varejo,
 * `permupay_customers`) e pessoa jurídica (empresas B2B,
 * `permupay_business_accounts`) pedida na evolução comercial — ver
 * docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md. A ficha PF tem página de
 * detalhe própria (ClienteDetalhe.tsx); a ficha PJ já é gerida em
 * Gestão Comercial (/b2b-admin), que esta lista referencia em vez de
 * duplicar.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, Building2, ChevronRight } from "lucide-react";

type Row = {
  key: string;
  type: "PF" | "PJ";
  id: number;
  name: string;
  contact: string;
  status?: string;
  href: string;
};

export default function Clientes() {
  const [search, setSearch] = useState("");
  const customers = trpc.customers.admin.list.useQuery({ search: search || undefined });
  const businesses = trpc.b2b.admin.businesses.useQuery();

  const rows: Row[] = useMemo(() => {
    const pf: Row[] = (customers.data ?? []).map(customer => ({
      key: `pf-${customer.id}`,
      type: "PF",
      id: customer.id,
      name: customer.name,
      contact: customer.contact,
      href: `/clientes/${customer.id}`,
    }));

    const needle = search.trim().toLowerCase();
    const pj: Row[] = (businesses.data ?? [])
      .filter((business: any) =>
        !needle ||
        `${business.trade_name || ""} ${business.legal_name || ""} ${business.cnpj || ""}`
          .toLowerCase()
          .includes(needle)
      )
      .map((business: any) => ({
        key: `pj-${business.id}`,
        type: "PJ" as const,
        id: business.id,
        name: business.trade_name || business.legal_name,
        contact: business.cnpj,
        status: business.status,
        href: "/b2b-admin",
      }));

    return [...pf, ...pj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [customers.data, businesses.data, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pessoa física e pessoa jurídica em um só lugar — histórico, dados e relacionamento.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nome, contato, e-mail, CPF ou CNPJ"
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contato / documento</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(row => (
                <tr key={row.key} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Badge variant={row.type === "PJ" ? "default" : "secondary"} className="gap-1">
                      {row.type === "PJ" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {row.type === "PJ" ? "Empresa" : "Pessoa física"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.contact}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={row.href} className="inline-flex items-center gap-1 text-sm text-[#215b94] hover:underline">
                      Ver ficha <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && !customers.isLoading && !businesses.isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
