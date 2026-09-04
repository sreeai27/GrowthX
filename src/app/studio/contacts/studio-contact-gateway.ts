export type StudioRole = "OPERATOR" | "PLATFORM_ADMIN";
export type StudioActor = { actorId: string; role: StudioRole; tenantId: string };
export type RevealReason = "RESULT_DELIVERY" | "CONSENTED_INVITATION";

export type MaskedContact = {
  contactId: string;
  maskedDisplay: string;
  channel: "EMAIL" | "MOBILE";
  invitationConsent: boolean;
  resultExpiresAt: string;
};

export type DeletionRequestView = {
  requestId: string;
  maskedDisplay: string;
  state: "PENDING" | "SECOND_REVIEW_REQUIRED" | "APPROVED";
  dueAt: string;
  requestedByActorId: string;
};

export interface StudioContactGateway {
  listContacts(actor: StudioActor): Promise<MaskedContact[]>;
  getContact(actor: StudioActor, contactId: string): Promise<MaskedContact | null>;
  revealContact(input: StudioActor & { contactId: string; reason: RevealReason | "" }): Promise<string>;
  listDeletions(actor: StudioActor): Promise<DeletionRequestView[]>;
  reviewDeletion(input: StudioActor & { requestId: string }): Promise<void>;
}

const contact = {
  contactId: "contact-asha",
  maskedDisplay: "a***a@example.com",
  channel: "EMAIL" as const,
  invitationConsent: true,
  resultExpiresAt: "2026-10-04T12:00:00.000Z",
};

export function createFixtureStudioContactGateway(): StudioContactGateway {
  return {
    async listContacts(actor) {
      return actor.tenantId === "demo_sahaay_home_services" ? [contact] : [];
    },
    async getContact(actor, contactId) {
      return actor.tenantId === "demo_sahaay_home_services" && contactId === contact.contactId ? contact : null;
    },
    async revealContact(input) {
      if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED");
      if (!input.reason) throw new Error("REASON_REQUIRED");
      if (input.contactId !== contact.contactId || input.tenantId !== "demo_sahaay_home_services") throw new Error("NOT_FOUND");
      return "asha@example.com";
    },
    async listDeletions(actor) {
      if (actor.tenantId !== "demo_sahaay_home_services") return [];
      return [{ requestId: "deletion-uncertain", maskedDisplay: contact.maskedDisplay, state: "SECOND_REVIEW_REQUIRED", dueAt: "2026-09-11T12:00:00.000Z", requestedByActorId: "admin-meera" }];
    },
    async reviewDeletion(input) {
      if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED");
      if (input.requestId === "deletion-uncertain" && input.actorId === "admin-meera") throw new Error("DISTINCT_REVIEWER_REQUIRED");
    },
  };
}
