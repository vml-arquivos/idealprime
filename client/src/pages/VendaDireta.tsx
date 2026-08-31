import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  CheckCircle2,
  Copy,
  Link2,
  ShoppingBag,
  Users,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

export default function VendaDireta() {
  const params = useParams<{ token?: string }>();
  const accessToken = params.token ? decodeURIComponent(params.token) : "";
  const catalogQuery = trpc.sellers.catalog.useQuery(
    { accessToken },
    { enabled: !!accessToken }
  );
  const seller = catalogQuery.data?.seller;
  const networkQuery = trpc.sellers.network.useQuery(
    { accessToken },
    { enabled: Boolean(accessToken && seller) }
  );
  const rankingQuery = trpc.sellers.myRanking.useQuery(
    { accessToken, period: "30d" },
    { enabled: Boolean(accessToken && seller) }
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );
  const [form, setForm] = useState({
    name: "",
    contact: "",
    paymentMethod: "PIX" as PaymentMethod,
    quantity: "1",
  });
  const [successOrderId, setSuccessOrderId] = useState<number | null>(null);
  const createOrder = trpc.sellers.createDirectOrder.useMutation({
    onSuccess: order => setSuccessOrderId(order.id),
    onError: error => toast.error(error.message),
  });
  const selectedProduct = catalogQuery.data?.products.find(
    product => product.id === selectedProductId
  );

  if (!accessToken || catalogQuery.error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFDFC] p-6">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Link de vendedor inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicite um novo link ao responsável pela loja.
          </p>
        </div>
      </div>
    );
  if (catalogQuery.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando catálogo...
      </div>
    );

  const submit = () => {
    if (!selectedProduct) return toast.error("Selecione um produto.");
    if (!form.name.trim() || !form.contact.trim())
      return toast.error("Informe nome e contato.");
    const quantity = Math.max(1, Number(form.quantity) || 1);
    const unitPrice = Number(
      selectedProduct.suggestedPricePix || selectedProduct.suggestedPrice || 0
    );
    createOrder.mutate({
      referralCode: seller?.referralCode,
      accessToken,
      productId: selectedProduct.id,
      quantity,
      unitPrice,
      markAsPaid: false,
      buyerName: form.name.trim(),
      buyerContact: form.contact.trim(),
      buyerContactType: form.contact.includes("@") ? "EMAIL" : "WHATSAPP",
      paymentMethod: form.paymentMethod,
    });
  };
  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const referralLink = seller
    ? `${origin}/seja-vendedor?patrocinador=${encodeURIComponent(seller.referralCode)}`
    : "";
  const storeLink = seller
    ? `${origin}/loja/${encodeURIComponent(seller.referralCode)}`
    : "";

  return (
    <main className="min-h-screen bg-[#FBFDFC]">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="rounded-2xl bg-gradient-to-br from-[#0C4536] via-[#068A5B] to-[#098EC7] p-6 text-white shadow-[0_18px_60px_rgba(6,138,91,0.16)]">
          <BrandLogo variant="white" compact className="mb-5 w-[170px]" />
          <p className="text-xs uppercase tracking-[0.24em] text-[#9ADCF2]">
            Painel do vendedor
          </p>
          <h1 className="mt-2 text-3xl font-bold">{seller?.name}</h1>
          <p className="mt-2 text-sm text-white/75">
            Venda produtos, acompanhe sua equipe e compartilhe seus links.
          </p>
        </header>
        <Tabs defaultValue="vender" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="vender" className="gap-2">
              <ShoppingBag className="h-4 w-4" /> Vender
            </TabsTrigger>
            <TabsTrigger value="indicacao" className="gap-2">
              <Link2 className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Indicação</span>
              <span className="sm:hidden">Link</span>
            </TabsTrigger>
            <TabsTrigger value="equipe" className="gap-2">
              <Users className="h-4 w-4" /> Equipe
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="h-4 w-4" /> Ranking
            </TabsTrigger>
          </TabsList>
          <TabsContent value="vender">
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">Produtos disponíveis</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(catalogQuery.data?.products ?? []).map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className={`rounded-xl border p-3 text-left transition ${selectedProductId === product.id ? "border-slate-950 ring-2 ring-slate-950/10" : "hover:border-slate-400"}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#FBFDFC]">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ShoppingBag className="h-7 w-7 text-white/75" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold">{product.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {product.stockQuantity} un. disponíveis
                          </p>
                          <p className="mt-2 font-bold">
                            {fmt(
                              Number(
                                product.suggestedPricePix ||
                                  product.suggestedPrice
                              )
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!catalogQuery.data?.products.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum produto disponível para venda externa.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">Registrar pedido</h2>
                {successOrderId ? (
                  <div className="mt-8 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                    <h3 className="mt-3 text-xl font-semibold">
                      Pedido reservado
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pedido #{successOrderId}. O vendedor entrará em contato
                      para confirmar o pagamento.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-[#FBFDFC] p-3 text-sm">
                      {selectedProduct ? (
                        <>
                          <span className="text-muted-foreground">
                            Produto selecionado
                          </span>
                          <strong className="mt-1 block">
                            {selectedProduct.name}
                          </strong>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Selecione um produto ao lado.
                        </span>
                      )}
                    </div>
                    <Input
                      placeholder="Seu nome"
                      value={form.name}
                      onChange={event =>
                        setForm({ ...form, name: event.target.value })
                      }
                    />
                    <Input
                      placeholder="WhatsApp ou e-mail"
                      value={form.contact}
                      onChange={event =>
                        setForm({ ...form, contact: event.target.value })
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Quantidade"
                        value={form.quantity}
                        onChange={event =>
                          setForm({ ...form, quantity: event.target.value })
                        }
                      />
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={form.paymentMethod}
                        onChange={event =>
                          setForm({
                            ...form,
                            paymentMethod: event.target.value as PaymentMethod,
                          })
                        }
                      >
                        <option value="PIX">Pix</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="CARTAO">Cartão</option>
                        <option value="BOLETO">Boleto</option>
                      </select>
                    </div>
                    <Button
                      className="w-full"
                      disabled={createOrder.isPending || !selectedProduct}
                      onClick={submit}
                    >
                      Reservar produto
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      O preço é validado pelo servidor no momento da reserva.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </TabsContent>
          <TabsContent value="indicacao" className="space-y-4">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-start gap-3">
                <Link2 className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">
                    Meu link de indicação
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Envie este link para quem você quiser convidar como
                    vendedor. A venda dele conta para sua rede.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={referralLink} />
                <Button
                  className="gap-2"
                  onClick={() =>
                    copy(referralLink, "Link de indicação copiado")
                  }
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            </section>
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-semibold">Link da sua loja</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compartilhe seu catálogo para o cliente comprar sozinho.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={storeLink} />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => copy(storeLink, "Link da loja copiado")}
                >
                  <Copy className="h-4 w-4" /> Copiar loja
                </Button>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="equipe">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Minha equipe</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vendedores cadastrados pela sua indicação.
                  </p>
                </div>
                <Badge variant="outline">
                  {networkQuery.data?.length ?? 0} direto(s)
                </Badge>
              </div>
              {networkQuery.isLoading ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  Carregando equipe…
                </p>
              ) : networkQuery.data?.length ? (
                <div className="mt-5 divide-y">
                  {networkQuery.data.map(member => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Desde{" "}
                          {new Date(member.createdAt).toLocaleDateString(
                            "pt-BR"
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">
                          {fmt(Number(member.totalCommission))}
                        </span>
                        <Badge
                          variant={member.active ? "secondary" : "outline"}
                        >
                          {member.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl bg-[#FBFDFC] p-8 text-center text-sm text-muted-foreground">
                  Ainda não há vendedores na sua equipe. Compartilhe seu link de
                  indicação.
                </div>
              )}
            </section>
          </TabsContent>
          <TabsContent value="ranking">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Meu ranking</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Posição nos últimos 30 dias, com base nas comissões
                    registradas.
                  </p>
                </div>
              </div>
              {rankingQuery.isLoading ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  Calculando sua posição…
                </p>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#FBFDFC] p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Posição
                    </p>
                    <p className="mt-2 text-3xl font-bold">
                      {rankingQuery.data?.position
                        ? `${rankingQuery.data.position}º`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FBFDFC] p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Volume vendido
                    </p>
                    <p className="mt-2 text-xl font-bold">
                      {fmt(Number(rankingQuery.data?.seller?.totalSold))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FBFDFC] p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Comissão
                    </p>
                    <p className="mt-2 text-xl font-bold">
                      {fmt(Number(rankingQuery.data?.seller?.totalCommission))}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
