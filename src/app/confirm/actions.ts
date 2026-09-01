"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hashDemoToken } from "../../domain/demo-session";
import { getCustomerConfirmationGateway } from "../../services/providers/customer-confirmation";

const routeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function getCustomerConfirmation(rawToken: string) {
  const parsed = routeTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { kind: "INVALID" as const };
  return getCustomerConfirmationGateway().getCustomerConfirmation(
    hashDemoToken(parsed.data),
  );
}

export async function confirmCustomerRequestAction(formData: FormData) {
  const input = z
    .object({
      token: routeTokenSchema,
      answer: z.enum(["YES", "MISMATCH"]),
    })
    .strict()
    .parse({ token: formData.get("token"), answer: formData.get("answer") });
  await getCustomerConfirmationGateway().confirmCustomerRequest(
    hashDemoToken(input.token),
    input.answer,
  );
  redirect(`/confirm/${input.token}`);
}

export async function respondToConfirmationAction(formData: FormData) {
  const input = z
    .object({
      token: routeTokenSchema,
      response: z.enum(["APPROVE", "DECLINE"]),
    })
    .strict()
    .parse({ token: formData.get("token"), response: formData.get("response") });
  await getCustomerConfirmationGateway().respondToConfirmation(
    hashDemoToken(input.token),
    input.response,
  );
  redirect(`/confirm/${input.token}`);
}
