import "server-only";

interface AnnounceHeroProps {
  businessName: string;
  targetCar?: { brand: string; model: string; year: number } | null;
}

export function AnnounceHero({ businessName, targetCar = null }: AnnounceHeroProps) {
  return (
    <section data-testid="announce-hero" className="w-full bg-background py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/55">
            Avaliação de troca
          </p>
          <h1
            className="mt-4 font-bold leading-[1.04] text-foreground"
            style={{ fontSize: "clamp(2.75rem, 7vw, 5.5rem)" }}
          >
            Anuncie seu carro aqui
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/70 md:text-lg">
            Envie os dados do veículo para a equipe da {businessName} avaliar
            procedência, condição e oportunidade de negociação.
          </p>
          {targetCar && (
            <div
              data-testid="announce-target-car"
              className="mt-6 rounded-md border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/75"
            >
              Você está avaliando seu carro como entrada para:{" "}
              <strong className="text-foreground">
                {targetCar.brand} {targetCar.model} {targetCar.year}
              </strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
