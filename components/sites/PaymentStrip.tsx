import Image from "next/image";

const PAYMENT_METHODS = [
  { name: "Pix", src: "/assets/payment/pix.svg" },
  { name: "Cartão", src: "/assets/payment/cartao.svg" },
  { name: "Financiamento", src: "/assets/payment/financiamento.svg" },
  { name: "Troca", src: "/assets/payment/troca.svg" },
  { name: "Boleto", src: "/assets/payment/boleto.svg" },
  { name: "Dinheiro", src: "/assets/payment/dinheiro.svg" },
] as const;

export function PaymentStrip() {
  return (
    <section
      aria-label="Métodos de pagamento"
      role="group"
      className="border-t border-foreground/10 py-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 md:px-8">
        <h2 className="text-xs font-semibold uppercase tracking-normal text-foreground/55">
          Métodos de pagamento
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.src}>
              <div className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-3 text-center">
                <Image
                  src={method.src}
                  alt={method.name}
                  width={40}
                  height={40}
                  loading="lazy"
                  unoptimized
                  decoding="async"
                  className="size-10 object-contain"
                />
                <span
                  aria-hidden="true"
                  className="text-xs font-medium text-foreground/60"
                >
                  {method.name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
