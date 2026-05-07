"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Search, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildGoogleMapsSearchInput,
  searchFormSchema,
  type SearchFormInput,
  type SearchFormValues,
} from "@/lib/validators/search";
import { SearchProgress } from "@/components/search/search-progress";

const POLL_INTERVAL_MS = process.env.NODE_ENV === "test" ? 10 : 3_000;

interface SubmitResponse {
  jobId: string;
  status: string;
}

interface JobStatus {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  results_count: number;
  error_message: string | null;
}

function isSubmitResponse(value: unknown): value is SubmitResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.jobId === "string" && typeof record.status === "string";
}

function isJobStatus(value: unknown): value is JobStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.status === "string";
}

function getErrorMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "Erro inesperado";
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : "Erro inesperado";
}

export function SearchForm() {
  const router = useRouter();
  const [termInput, setTermInput] = useState("");
  const [pending, setPending] = useState(false);
  const [jobStatus, setJobStatus] = useState<
    "queued" | "running" | "succeeded" | "failed"
  >("queued");
  const [resultsCount, setResultsCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const form = useForm<SearchFormValues, unknown, SearchFormInput>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      terms: [],
      city: "",
      state: "",
      maxCrawledPlacesPerSearch: 50,
    },
  });

  const terms = useWatch({ control: form.control, name: "terms" }) ?? [];

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollJobStatus = useCallback(
    (id: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/search-jobs/${id}`);
          if (!response.ok) return;

          const payload = (await response.json()) as unknown;
          if (!isJobStatus(payload)) return;

          setJobStatus(payload.status);
          setResultsCount(payload.results_count);

          if (payload.status === "succeeded") {
            stopPolling();
            setPending(false);
            toast.success("Busca concluída", {
              description: `${payload.results_count} leads encontrados.`,
            });
            router.push(`/leads?searchJobId=${id}`);
          } else if (payload.status === "failed") {
            stopPolling();
            setPending(false);
            toast.error("Busca falhou", {
              description:
                payload.error_message ?? "Erro desconhecido no actor Apify.",
            });
          }
        } catch {
          // Falha de rede no polling — continua tentando.
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, router],
  );

  function addTerm() {
    const term = termInput.trim();
    if (!term) return;
    if (terms.includes(term)) {
      setTermInput("");
      return;
    }
    form.setValue("terms", [...terms, term], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setTermInput("");
  }

  function removeTerm(term: string) {
    form.setValue(
      "terms",
      terms.filter((item) => item !== term),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function onSubmit(values: SearchFormInput) {
    setPending(true);
    setJobStatus("queued");
    setResultsCount(0);
    try {
      const response = await fetch("/api/apify/google-maps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildGoogleMapsSearchInput(values)),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        toast.error("Busca falhou", { description: getErrorMessage(payload) });
        setPending(false);
        return;
      }

      if (!isSubmitResponse(payload)) {
        toast.error("Busca falhou", { description: "Resposta inválida" });
        setPending(false);
        return;
      }

      setJobStatus("queued");
      pollJobStatus(payload.jobId);
    } catch (error) {
      toast.error("Busca falhou", {
        description:
          error instanceof Error ? error.message : "Erro inesperado",
      });
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova busca</CardTitle>
        <CardDescription>
          Monte consultas por fonte e envie para coleta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="google-maps" className="gap-5">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="google-maps">Google Maps</TabsTrigger>
            <TabsTrigger value="instagram" disabled>
              Instagram
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google-maps">
            <Form {...form}>
              <form
                aria-label="Buscar leads"
                className="space-y-5"
                // eslint-disable-next-line react-hooks/refs
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="search-term"
                  >
                    Termo de busca
                  </label>
                  <div
                    data-testid="search-term-row"
                    className="flex min-w-0 flex-col gap-2 sm:flex-row"
                  >
                    <Input
                      id="search-term"
                      value={termInput}
                      onChange={(event) => setTermInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTerm();
                        }
                      }}
                      placeholder="barbearia, clínica estética..."
                      disabled={pending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTerm}
                      disabled={pending}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="size-4" />
                      Adicionar termo
                    </Button>
                  </div>
                  {form.formState.errors.terms?.message ? (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.terms.message}
                    </p>
                  ) : null}
                  {terms.length ? (
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {terms.map((term) => (
                        <Badge key={term} variant="secondary" className="max-w-full">
                          <span className="truncate">{term}</span>
                          <button
                            type="button"
                            className="hover:text-foreground"
                            onClick={() => removeTerm(term)}
                            aria-label={`Remover termo ${term}`}
                            disabled={pending}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_160px_200px]">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Curitiba"
                            disabled={pending}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="PR"
                            disabled={pending}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxCrawledPlacesPerSearch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade por termo</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            disabled={pending}
                            name={field.name}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            value={field.value}
                            onChange={(event) =>
                              field.onChange(event.currentTarget.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {pending ? (
                  <SearchProgress
                    actorName="Google Maps Scraper"
                    status={jobStatus}
                    resultsCount={resultsCount}
                  />
                ) : null}

                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Buscar
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
