import Image from "next/image";

const BANKS = [
  { name: "Santander", src: "/assets/banks/santander.svg" },
  { name: "Bradesco", src: "/assets/banks/bradesco.svg" },
  { name: "Itaú", src: "/assets/banks/itau.svg" },
  { name: "BV", src: "/assets/banks/bv.svg" },
  { name: "Banco PAN", src: "/assets/banks/pan.svg" },
  { name: "Caixa", src: "/assets/banks/caixa.svg" },
  { name: "Porto Bank", src: "/assets/banks/porto.svg" },
] as const;

export function BanksStrip() {
  return (
    <section
      aria-label="Bancos parceiros"
      role="group"
      className="border-t border-foreground/10 py-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 md:px-8">
        <h2 className="text-xs font-semibold uppercase tracking-normal text-foreground/55">
          Bancos parceiros
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {BANKS.map((bank) => (
            <li key={bank.src}>
              <div className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-3 text-center">
                <Image
                  src={bank.src}
                  alt={bank.name}
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
                  {bank.name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
