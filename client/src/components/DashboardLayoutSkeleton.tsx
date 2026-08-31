/**
 * DashboardLayoutSkeleton.tsx
 * 
 * Componente de loading skeleton para o DashboardLayout.
 * Exibido enquanto o estado de autenticação está sendo carregado.
 * 
 * ATENÇÃO: Este arquivo NÃO deve importar DashboardLayout nem a si mesmo.
 */

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <div className="w-[260px] border-r flex flex-col shrink-0">
        {/* Header do sidebar */}
        <div className="h-16 border-b flex items-center gap-3 px-4">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
        </div>

        {/* Itens do menu */}
        <div className="flex flex-col gap-1 p-3 flex-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-9 rounded-lg bg-muted animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}

          {/* Separador de admin */}
          <div className="h-3 w-20 rounded bg-muted/60 animate-pulse mt-4 mb-2 mx-1" />

          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={`admin-${i}`}
              className="h-9 rounded-lg bg-muted animate-pulse"
              style={{ animationDelay: `${(i + 7) * 60}ms` }}
            />
          ))}
        </div>

        {/* Footer do sidebar */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-32 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Título da página */}
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-72 rounded bg-muted/60 animate-pulse" />
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-5 space-y-3"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
              </div>
            ))}
          </div>

          {/* Tabela / conteúdo */}
          <div className="rounded-xl border overflow-hidden">
            <div className="h-12 border-b bg-muted/30 px-4 flex items-center gap-4">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 border-b last:border-0 px-4 flex items-center gap-4"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
                <div className="h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
                <div className="h-3.5 w-16 rounded bg-muted/60 animate-pulse" />
                <div className="ml-auto h-7 w-20 rounded-lg bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
