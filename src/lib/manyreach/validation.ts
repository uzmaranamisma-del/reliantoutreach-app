import { z } from "zod";
import contract from "./contract.json";
export function providerSchema(name: keyof typeof contract) {
  const definition = contract[name];
  const fields: Record<string, z.ZodType> = {};
  for (const [key, raw] of Object.entries(definition.properties)) {
    const field = raw as {
      type: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
      maxLength?: number;
      minLength?: number;
    };
    let value: z.ZodType;
    if (field.enum) value = z.enum(field.enum as [string, ...string[]]);
    else if (field.type === "integer")
      value = z
        .number()
        .int()
        .min(field.minimum ?? -2147483648)
        .max(Math.min(field.maximum ?? 2147483647, Number.MAX_SAFE_INTEGER));
    else if (field.type === "boolean") value = z.boolean();
    else
      value = z
        .string()
        .min(field.minLength ?? 0)
        .max(field.maxLength ?? 100_000);
    fields[key] = (definition.required as string[] | null)?.includes(key)
      ? value
      : value.optional();
  }
  return z.object(fields).strict();
}
export const resourceSchemas = {
  campaigns: ["CampaignCreate", "CampaignUpdate"],
  prospects: ["ProspectCreate", "ProspectUpdate"],
  lists: ["ListCreate", "ListUpdate"],
  senders: ["SenderCreate", "SenderUpdate"],
  sequences: ["SequenceCreate", "SequenceUpdate"],
  followups: ["FollowupCreate", "FollowupUpdate"],
} as const;
