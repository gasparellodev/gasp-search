import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#0ea5e9";

const nameSchema = z.string().trim().min(2, "Nome muito curto").max(40);
const colorSchema = z
  .string()
  .regex(HEX_COLOR, "Cor precisa ser hexadecimal #RRGGBB");

export const createTagSchema = z
  .object({
    name: nameSchema,
    color: colorSchema.default(DEFAULT_COLOR),
  })
  .strict();

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({
    name: nameSchema.optional(),
    color: colorSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Body precisa ter ao menos um campo",
  });

export type UpdateTagInput = z.infer<typeof updateTagSchema>;
