import { createHash } from "node:crypto";

import { z } from "zod";

export const deliveryRequestSchema = z
  .object({
    channel: z.enum(["EMAIL", "SMS"]),
    destination: z.string().min(1),
    resultUrl: z.string().url(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.channel === "EMAIL" &&
      !z.string().email().safeParse(request.destination).success
    ) {
      context.addIssue({ code: "custom", message: "Invalid email destination." });
    }
    if (
      request.channel === "SMS" &&
      !/^\+91[6-9]\d{9}$/.test(request.destination)
    ) {
      context.addIssue({ code: "custom", message: "Invalid Indian mobile destination." });
    }
  });

export const deliveryReceiptSchema = z
  .object({
    provider: z.string().min(1).max(80),
    providerMessageId: z.string().min(1).max(200),
    acceptedAt: z.string().datetime(),
  })
  .strict();

export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;
export type DeliveryReceipt = z.infer<typeof deliveryReceiptSchema>;

export interface PrivateResultDeliveryProvider {
  send(input: DeliveryRequest): Promise<DeliveryReceipt>;
}

export class MockPrivateResultDeliveryProvider
  implements PrivateResultDeliveryProvider
{
  async send(input: DeliveryRequest): Promise<DeliveryReceipt> {
    const request = deliveryRequestSchema.parse(input);
    const providerMessageId = createHash("sha256")
      .update(
        `${request.channel}:${request.destination}:${request.resultUrl}:${request.expiresAt}`,
      )
      .digest("hex")
      .slice(0, 24);
    return deliveryReceiptSchema.parse({
      provider: "DEMONSTRATION_DELIVERY",
      providerMessageId: `demo-${providerMessageId}`,
      acceptedAt: new Date().toISOString(),
    });
  }
}

export function getPrivateResultDeliveryProvider(
  nodeEnvironment: string | undefined,
): PrivateResultDeliveryProvider {
  if (nodeEnvironment === "production") {
    throw new Error(
      "Private result delivery requires an authorised production provider.",
    );
  }
  return new MockPrivateResultDeliveryProvider();
}
