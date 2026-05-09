/**
 * Heurística de categorização de carros para o filtro `?categoria=` da página
 * `/sites/[slug]/estoque` (Phase 7 — issue #164).
 *
 * **V1**: pré-classifica `SiteCar` em uma das categorias canônicas
 * (`sedan` / `suv` / `picape` / `hatch` / `esportivo`) por palavra-chave
 * em `model` (case-insensitive, NFKD normalizado para tirar acentos).
 *
 * Razão: `SiteCar` (per spec §4) ainda não tem campo `category` próprio. O
 * filtro da Home (#162) e do Estoque (este, #164) usam o `slugify(label)` da
 * `home_categories[]` como query param. Essa heurística cobre casos comuns
 * do mercado brasileiro de seminovos.
 *
 * Pure function — sem deps de network/fs. Testada em
 * `tests/unit/components/sites/stock/car-categories.test.ts`.
 *
 * **Não cobre** a categoria `0km` / `seminovos` / `promocao` etc. (que
 * dependem de outros sinais — ano, condição). Para essas, a heurística
 * retorna `null` e o filtro vira "no-op" (mostra todos os carros). É o
 * comportamento aceitável V1 — listagem completa nunca quebra.
 */

const SUV_KEYWORDS = [
  "suv",
  "compass",
  "renegade",
  "duster",
  "tracker",
  "kicks",
  "creta",
  "tcross",
  "t-cross",
  "nivus",
  "taos",
  "tiguan",
  "rav4",
  "hrv",
  "hr-v",
  "wrv",
  "wr-v",
  "captur",
  "ecosport",
  "territory",
  "edge",
  "explorer",
  "sw4",
  "pajero",
  "outlander",
  "tucson",
  "sportage",
  "santa fe",
  "santafe",
  "x1",
  "x3",
  "x5",
  "x6",
  "q3",
  "q5",
  "q7",
  "glc",
  "gle",
  "gls",
  "macan",
  "cayenne",
];

const PICAPE_KEYWORDS = [
  "picape",
  "pickup",
  "hilux",
  "ranger",
  "amarok",
  "frontier",
  "s10",
  "saveiro",
  "strada",
  "montana",
  "toro",
  "oroch",
  "maverick",
  "f-150",
  "f150",
  "ram",
  "gladiator",
  "l200",
  "triton",
];

// Keywords são comparadas após `normalize()` (NFKD + sem combining
// marks). "Sedã" no DOM bate com "seda" aqui — é por isso que ambos
// estão listados.
const SEDAN_KEYWORDS = [
  "sedan",
  "seda",
  "corolla",
  "civic",
  "city",
  "logan",
  "voyage",
  "siena",
  "cronos",
  "versa",
  "altima",
  "fusion",
  "passat",
  "jetta",
  "virtus",
  "polo sedan",
  "onix plus",
  "prisma",
  "cobalt",
  "elantra",
  "sentra",
  "accord",
  "320i",
  "330i",
  "a3 sedan",
  "a4",
  "c180",
  "c200",
  "c250",
  "c300",
];

const HATCH_KEYWORDS = [
  "hatch",
  "hb20",
  "onix",
  "polo",
  "fox",
  "gol",
  "up",
  "ka",
  "fiesta",
  "fit",
  "i30",
  "march",
  "mobi",
  "argo",
  "uno",
  "palio",
  "punto",
  "celta",
  "yaris",
  "etios",
  "sandero",
  "stepway",
  "kwid",
  "swift",
  "picanto",
  "soul",
  "a1",
  "a3 sportback",
  "115i",
  "118i",
  "120i",
  "a200",
  "clase a",
];

const ESPORTIVO_KEYWORDS = [
  "esportivo",
  "sport",
  "gti",
  "gtr",
  "gt-r",
  "rs",
  "amg",
  "m2",
  "m3",
  "m4",
  "m5",
  "m6",
  " r ",
  "type r",
  "type-r",
  "trd",
  "srt",
  "scat pack",
  "hellcat",
  "zr1",
  "zr-1",
  "z06",
  "v8",
  "v10",
  "v12",
  "ferrari",
  "lamborghini",
  "porsche",
  "911",
  "boxster",
  "cayman",
  "supra",
  "mustang",
  "camaro",
  "challenger",
  "maserati",
];

export type CarCategorySlug =
  | "sedan"
  | "suv"
  | "picape"
  | "hatch"
  | "esportivo";

export const KNOWN_CATEGORY_SLUGS: ReadonlySet<CarCategorySlug> = new Set([
  "sedan",
  "suv",
  "picape",
  "hatch",
  "esportivo",
]);

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // remove combining marks (acentos, til, cedilha)
    .toLowerCase();
}

function matches(haystack: string, keywords: ReadonlyArray<string>): boolean {
  return keywords.some((kw) => haystack.includes(kw));
}

/**
 * Classifica um carro em uma das `CarCategorySlug` canônicas. Retorna
 * `null` quando nenhuma keyword bate (caller decide o fallback —
 * tipicamente "mostra em qualquer filtro" ou "não filtra").
 *
 * Ordem de checagem **importa** — algumas keywords são ambíguas ("Polo"
 * tanto hatch quanto sedan; "T-Cross" é SUV mesmo tendo "Cross" no
 * nome). A ordem foi escolhida pra resolver na categoria mais específica
 * primeiro: `picape` > `esportivo` > `suv` > `sedan` > `hatch`.
 */
export function classifyCar(car: {
  brand: string;
  model: string;
}): CarCategorySlug | null {
  const haystack = normalize(`${car.brand} ${car.model}`);

  if (matches(haystack, PICAPE_KEYWORDS)) return "picape";
  if (matches(haystack, ESPORTIVO_KEYWORDS)) return "esportivo";
  if (matches(haystack, SUV_KEYWORDS)) return "suv";
  if (matches(haystack, SEDAN_KEYWORDS)) return "sedan";
  if (matches(haystack, HATCH_KEYWORDS)) return "hatch";

  return null;
}

/**
 * Parser do query param `?categoria=` — aceita CSV (`?categoria=sedan,suv`)
 * e devolve um `Set` de categorias **conhecidas**. Tokens desconhecidos
 * são silenciosamente descartados (input adversarial vira no-op em vez
 * de erro 500).
 *
 * Retorna `null` quando o input é vazio ou só tem tokens inválidos —
 * caller interpreta `null` como "sem filtro" (lista todos).
 */
export function parseCategoriaParam(
  raw: string | null | undefined,
): ReadonlySet<CarCategorySlug> | null {
  if (!raw) return null;
  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const valid = tokens.filter((t): t is CarCategorySlug =>
    (KNOWN_CATEGORY_SLUGS as ReadonlySet<string>).has(t),
  );
  if (valid.length === 0) return null;
  return new Set(valid);
}
