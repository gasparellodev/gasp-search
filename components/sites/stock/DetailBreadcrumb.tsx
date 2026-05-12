import "server-only";

import { Breadcrumb } from "@/components/sites/Breadcrumb";

interface DetailBreadcrumbProps {
  slug: string;
  brand: string;
  model: string;
  year: number;
}

export function DetailBreadcrumb({
  slug,
  brand,
  model,
  year,
}: DetailBreadcrumbProps) {
  const stockHref = `/sites/${slug}/estoque`;

  return (
    <Breadcrumb
      className="mb-6"
      items={[
        { label: "Estoque", href: stockHref },
        { label: brand, href: `${stockHref}?m=${encodeURIComponent(brand)}` },
        { label: `${model} ${year}` },
      ]}
    />
  );
}
