import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCameraUpload } from "@/hooks/useCameraUpload";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { BrandLogo } from "@/components/BrandLogo";

type UploadValue = {
  url: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  pixKey: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  birthDate: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  pixKey: "",
};

function UploadSlot({
  label,
  value,
  busy,
  acceptLabel,
  onSelect,
}: {
  label: string;
  value: UploadValue | null;
  busy: boolean;
  acceptLabel: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{acceptLabel}</p>
        </div>
        {value ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>
      {value?.mimeType === "application/pdf" ? (
        <a
          className="mt-3 block truncate text-sm text-primary underline"
          href={value.dataUrl}
          target="_blank"
          rel="noreferrer"
        >
          {value.fileName}
        </a>
      ) : value ? (
        <img
          src={value.dataUrl}
          alt={label}
          className="mt-3 h-32 w-full rounded-lg bg-muted object-contain"
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full gap-2"
        onClick={onSelect}
        disabled={busy}
      >
        <Upload className="h-4 w-4" />{" "}
        {busy ? "Enviando…" : value ? "Trocar arquivo" : "Selecionar arquivo"}
      </Button>
    </div>
  );
}

export default function SejaVendedor() {
  const sponsorReferralCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search)
        .get("patrocinador")
        ?.trim()
        .toUpperCase() ?? ""
    );
  }, []);
  const sponsorQuery = trpc.sellers.sponsor.useQuery(
    { referralCode: sponsorReferralCode },
    { enabled: Boolean(sponsorReferralCode) }
  );
  const [step, setStep] = useState("pessoais");
  const [form, setForm] = useState<FormState>(initialForm);
  const [front, setFront] = useState<UploadValue | null>(null);
  const [back, setBack] = useState<UploadValue | null>(null);
  const [selfie, setSelfie] = useState<UploadValue | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const documentUpload = useDocumentUpload();
  const selfieUpload = useCameraUpload({ facingMode: "user" });
  const apply = trpc.sellers.applyAsSeller.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: error => toast.error(error.message),
  });

  const setField = (field: keyof FormState, value: string) =>
    setForm(current => ({ ...current, [field]: value }));
  const next = () => {
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.cpf.trim() ||
      !form.birthDate
    ) {
      toast.error("Preencha seus dados pessoais antes de continuar.");
      return;
    }
    setStep("documentos");
  };
  const submit = () => {
    if (!front || !selfie)
      return toast.error("Envie o documento da frente e uma selfie.");
    if (
      !form.address.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.zipCode.trim() ||
      !form.pixKey.trim()
    ) {
      return toast.error("Preencha endereço e chave Pix antes de enviar.");
    }
    apply.mutate({
      ...form,
      state: form.state.toUpperCase(),
      documentFrontUrl: front.url,
      documentBackUrl: back?.url,
      selfiePhotoUrl: selfie.url,
      sponsorReferralCode: sponsorReferralCode || undefined,
    });
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FBFDFC] p-6">
        <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <h1 className="mt-5 text-2xl font-bold">Cadastro enviado</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Recebemos seus dados.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex text-sm font-medium text-primary underline"
          >
            Voltar para a vitrine
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBFDFC] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a vitrine
        </Link>
        <header className="rounded-3xl bg-gradient-to-br from-[#0C4536] via-[#068A5B] to-[#098EC7] p-7 text-white shadow-[0_20px_70px_rgba(6,138,91,0.18)]">
          <BrandLogo variant="white" compact className="mb-6 w-[170px]" />
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-300/15 p-3">
              <ShieldCheck className="h-7 w-7 text-[#9ADCF2]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#9ADCF2]">
                Ideal Prime • Ideal Prime
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Preencha o cadastro de vendedor
              </h1>
            </div>
          </div>
          {sponsorReferralCode && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {sponsorQuery.isLoading ? (
                "Carregando indicação…"
              ) : sponsorQuery.data ? (
                <>
                  Você está se cadastrando pela indicação de{" "}
                  <strong className="text-white">
                    {sponsorQuery.data.name}
                  </strong>
                  .
                </>
              ) : (
                "O código de indicação informado não foi encontrado."
              )}
            </div>
          )}
        </header>

        <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
          <Tabs value={step} onValueChange={setStep}>
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="pessoais" className="gap-2">
                <UserRound className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Dados pessoais</span>
                <span className="sm:hidden">Pessoais</span>
              </TabsTrigger>
              <TabsTrigger value="documentos" className="gap-2">
                <FileText className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Documentos</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="recebimento" className="gap-2">
                <ShieldCheck className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Recebimento</span>
                <span className="sm:hidden">Pix</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pessoais" className="mt-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Seus dados pessoais</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.name}
                    onChange={event => setField("name", event.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={event =>
                      setField(
                        "cpf",
                        event.target.value.replace(/\D/g, "").slice(0, 11)
                      )
                    }
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={form.birthDate}
                    onChange={event =>
                      setField("birthDate", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={form.phone}
                    onChange={event => setField("phone", event.target.value)}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={event => setField("email", event.target.value)}
                    placeholder="voce@exemplo.com"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço completo</Label>
                  <Input
                    value={form.address}
                    onChange={event => setField("address", event.target.value)}
                    placeholder="Rua, número e complemento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.city}
                    onChange={event => setField("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    maxLength={2}
                    value={form.state}
                    onChange={event =>
                      setField("state", event.target.value.toUpperCase())
                    }
                    placeholder="UF"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.zipCode}
                    onChange={event => setField("zipCode", event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={next}>
                  Continuar
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="documentos" className="mt-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Seus documentos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Envie uma foto legível ou PDF do documento.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <UploadSlot
                  label="Documento — frente"
                  value={front}
                  busy={documentUpload.uploading}
                  acceptLabel="RG, CNH ou documento oficial"
                  onSelect={() => documentUpload.capture(setFront)}
                />
                <UploadSlot
                  label="Documento — verso"
                  value={back}
                  busy={documentUpload.uploading}
                  acceptLabel="Opcional, quando houver verso"
                  onSelect={() => documentUpload.capture(setBack)}
                />
              </div>
              <div className="rounded-xl border border-dashed p-4">
                <div className="flex items-start gap-3">
                  <Camera className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Selfie</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Abra a câmera frontal e mantenha o rosto visível.
                    </p>
                  </div>
                </div>
                {selfie && (
                  <img
                    src={selfie.dataUrl}
                    alt="Selfie"
                    className="mt-3 h-44 w-full rounded-lg bg-muted object-contain"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={() =>
                    selfieUpload.capture(result =>
                      setSelfie({
                        ...result,
                        fileName: "selfie.jpg",
                        mimeType: "image/jpeg",
                      })
                    )
                  }
                  disabled={selfieUpload.uploading}
                >
                  <Camera className="h-4 w-4" />{" "}
                  {selfieUpload.uploading
                    ? "Enviando…"
                    : selfie
                      ? "Refazer selfie"
                      : "Capturar selfie"}
                </Button>
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("pessoais")}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep("recebimento")}
                  disabled={!front || !selfie}
                >
                  Continuar
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="recebimento" className="mt-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">
                  Como receber suas comissões
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe a chave Pix que será usada quando houver comissão
                  liberada.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input
                  value={form.pixKey}
                  onChange={event => setField("pixKey", event.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("documentos")}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={apply.isPending}
                  className="gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />{" "}
                  {apply.isPending ? "Enviando dados…" : "Enviar dados"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}
