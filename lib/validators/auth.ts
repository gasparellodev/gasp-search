import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export const signUpSchema = z.object({
  fullName: z.string().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  email: z.email("E-mail inválido"),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
