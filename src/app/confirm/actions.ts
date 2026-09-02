"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hashCompletionToken, hashDemoToken } from "../../domain/demo-session";
import { getCustomerConfirmationGateway } from "../../services/providers/customer-confirmation";
import { getCompletionVerificationGateway } from "../../services/providers/completion-verification";

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
    .parse({
      token: formData.get("token"),
      response: formData.get("response"),
    });
  const gateway = getCustomerConfirmationGateway();
  await gateway.respondToConfirmation(
    hashDemoToken(input.token),
    input.response,
  );
  if (input.response === "APPROVE") {
    await gateway.executeApprovedAction(hashDemoToken(input.token));
  }
  redirect(`/confirm/${input.token}`);
}

export async function retryApprovedAction(formData: FormData) {
  const token = routeTokenSchema.parse(formData.get("token"));
  await getCustomerConfirmationGateway().executeApprovedAction(
    hashDemoToken(token),
  );
  redirect(`/confirm/${token}`);
}

export async function getCustomerCompletion(rawToken: string) {
  const parsed = routeTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { kind: "INVALID" as const };
  return getCompletionVerificationGateway().getForCustomer(
    hashCompletionToken(parsed.data),
  );
}

export async function respondToCompletionAction(formData: FormData) {
  const token = routeTokenSchema.parse(formData.get("token"));
  const response = z
    .enum(["ACKNOWLEDGE", "RAISE_ISSUE"])
    .parse(formData.get("response"));
  const noteValue = z
    .string()
    .trim()
    .max(500)
    .parse(formData.get("note") ?? "");
  await getCompletionVerificationGateway().respondAsCustomer(
    hashCompletionToken(token),
    {
      response,
      ...(noteValue ? { note: noteValue } : {}),
    },
  );
  redirect(`/confirm/${token}`);
}
