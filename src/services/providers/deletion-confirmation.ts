export type DeletionConfirmationReceipt = {
  provider: "DEMONSTRATION_NOTIFICATION_PROVIDER";
  providerMessageId: string;
  status: "DELIVERED";
  deliveredAt: string;
};

export interface DeletionConfirmationProvider {
  send(input: { deletionRequestId: string; channel: "EMAIL" | "INDIAN_MOBILE"; destination: string; deliveredAt: string }): Promise<DeletionConfirmationReceipt>;
}

export const demonstrationDeletionConfirmationProvider: DeletionConfirmationProvider = {
  async send(input) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Deletion confirmation requires an authorised production delivery provider.");
    }
    if (!input.destination || !input.channel) {
      throw new Error("Deletion confirmation requires a valid destination and channel.");
    }
    return {
      provider: "DEMONSTRATION_NOTIFICATION_PROVIDER",
      providerMessageId: `deletion-confirmation-${input.deletionRequestId}-${crypto.randomUUID()}`,
      status: "DELIVERED",
      deliveredAt: input.deliveredAt,
    };
  },
};
