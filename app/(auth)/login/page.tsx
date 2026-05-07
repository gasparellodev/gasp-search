"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validators/auth";
import { publicEnv } from "@/lib/env-public";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="bg-background mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <Loader2 className="text-primary size-8 animate-spin" />
    </main>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [oauthLoading, setOauthLoading] = useState(false);

  const signInForm = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  function handleSignIn(values: SignInInput) {
    startTransition(async () => {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        toast.error("Não foi possível entrar", {
          description: error.message,
        });
        return;
      }
      toast.success("Bem-vindo de volta");
      router.push(redirectTo);
      router.refresh();
    });
  }

  function handleSignUp(values: SignUpInput) {
    startTransition(async () => {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/callback`,
        },
      });
      if (error) {
        toast.error("Falha no cadastro", { description: error.message });
        return;
      }
      toast.success("Cadastro feito", {
        description: "Verifique seu e-mail para confirmar a conta.",
      });
      setTab("signin");
    });
  }

  async function handleGoogle() {
    setOauthLoading(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      toast.error("Falha ao iniciar Google", { description: error.message });
      setOauthLoading(false);
    }
  }

  return (
    <main className="bg-background mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          GaspLab
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Gasp Search</h1>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Entre na sua conta</CardTitle>
          <CardDescription>
            Use e-mail e senha ou Google para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorParam ? (
            <Alert variant="destructive">
              <AlertDescription>{errorParam}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={oauthLoading || pending}
            aria-label="Continuar com Google"
          >
            {oauthLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            Continuar com Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs uppercase">ou</span>
            <Separator className="flex-1" />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="pt-6">
              <Form {...signInForm}>
                <form
                  onSubmit={signInForm.handleSubmit(handleSignIn)}
                  className="space-y-4"
                  aria-label="Entrar"
                >
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="seu@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Entrar
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup" className="pt-6">
              <Form {...signUpForm}>
                <form
                  onSubmit={signUpForm.handleSubmit(handleSignUp)}
                  className="space-y-4"
                  aria-label="Cadastrar"
                >
                  <FormField
                    control={signUpForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            autoComplete="name"
                            placeholder="Seu Nome"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="seu@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Criar conta
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
