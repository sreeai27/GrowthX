export const DEMO_TENANT_ID = "demo_sahaay_home_services";

export const demoTenant = {
  tenantId: DEMO_TENANT_ID,
  name: "Sahaay Home Services",
  city: "Mumbai",
  defaultWorkerLanguage: "hi-IN",
  supportedCustomerLanguages: ["en-IN", "hi-IN"],
  policyPackVersion: "taskconfirm-demo-v1",
};

export const demoWorker = {
  publicUserId: "demo-worker-asha",
  tenantId: DEMO_TENANT_ID,
  role: "WORKER" as const,
  displayName: "Asha",
  locale: "hi-IN",
  status: "ACTIVE" as const,
};

export const demoBooking = {
  bookingKey: "DEMO-4821",
  tenantId: DEMO_TENANT_ID,
  workerPublicUserId: demoWorker.publicUserId,
  customerAlias: "Neha",
  serviceId: "essential_home_cleaning",
  serviceName: "Essential Home Cleaning",
  status: "IN_PROGRESS" as const,
  city: "Mumbai",
  currency: "INR" as const,
  scheduledDurationMinutes: 60,
  version: 1,
  includedTaskIds: [
    "kitchen_surface_cleaning",
    "bathroom_cleaning_standard_1",
    "floor_cleaning_standard",
  ],
  existingAddOnTaskIds: [] as string[],
  catalogVersion: "task-catalog-v1",
};

const task = (
  taskId: string,
  displayName: string,
  category: string,
  riskTier: number,
  synonymsHi: string[],
  synonymsMr: string[],
) => ({
  tenantId: DEMO_TENANT_ID,
  catalogVersion: "task-catalog-v1",
  taskId,
  displayName,
  category,
  riskTier,
  synonymsHi,
  synonymsMr,
  active: true,
});

export const demoTasks = [
  task(
    "kitchen_surface_cleaning",
    "Kitchen surface cleaning",
    "cleaning",
    1,
    ["किचन साफ करना"],
    ["स्वयंपाकघर पृष्ठभाग साफ"],
  ),
  task(
    "bathroom_cleaning_standard_1",
    "One standard bathroom",
    "cleaning",
    1,
    ["एक बाथरूम", "bathroom cleaning"],
    ["एक बाथरूम साफ करणे"],
  ),
  task(
    "floor_cleaning_standard",
    "Standard floor cleaning",
    "cleaning",
    1,
    ["फ्लोर साफ करना", "पोछा"],
    ["फरशी साफ करणे"],
  ),
  task(
    "balcony_deep_cleaning",
    "Balcony deep cleaning",
    "deep_cleaning",
    1,
    ["बालकनी डीप क्लीन", "balcony scrub"],
    ["बाल्कनी डीप क्लीन"],
  ),
  task(
    "inside_cabinet_cleaning",
    "Inside-cabinet cleaning",
    "deep_cleaning",
    1,
    ["कैबिनेट के अंदर साफ"],
    ["कॅबिनेट आतून साफ"],
  ),
  task(
    "wardrobe_assembly",
    "Wardrobe assembly",
    "assembly",
    2,
    ["अलमारी जोड़ना"],
    ["वॉर्डरोब जोडणे"],
  ),
  task(
    "exposed_live_wire_response",
    "Exposed live wire near work area",
    "electrical_safety",
    3,
    ["खुला बिजली का तार", "live wire"],
    ["उघडी वीज वायर"],
  ),
];

export const demoPolicySource = {
  tenantId: DEMO_TENANT_ID,
  sourceKey: "taskconfirm-demo-policy",
  title: "Sahaay Home Services Demonstration Task and Add-on Policy",
  owner: "Demo Operations Owner",
  version: "v1",
  status: "ACTIVE" as const,
  effectiveFrom: "2026-08-31T00:00:00.000Z",
  regionTags: ["Mumbai"],
  roleTags: ["cleaning_specialist"],
  notice: "Fictional demonstration policy; not a real operator policy.",
};

const baseRule = {
  tenantId: DEMO_TENANT_ID,
  sourceKey: demoPolicySource.sourceKey,
  sourceVersion: demoPolicySource.version,
  serviceId: demoBooking.serviceId,
  requiresCustomerRequestConfirmation: true,
  requiresCustomerCommercialApproval: false,
  requiresHumanReview: false,
  removableTaskIds: [] as string[],
};

export const demoPolicyRules = [
  {
    ...baseRule,
    ruleKey: "included-standard-bathroom",
    taskId: "bathroom_cleaning_standard_1",
    decisionState: "INCLUDED_CONTINUE" as const,
    durationDeltaMinutes: 0,
    priceDeltaMinor: 0,
    requiresCustomerRequestConfirmation: false,
  },
  {
    ...baseRule,
    ruleKey: "balcony-deep-clean-add-on",
    taskId: "balcony_deep_cleaning",
    decisionState: "ADD_ON_APPROVAL_REQUIRED" as const,
    durationDeltaMinutes: 25,
    priceDeltaMinor: 29_900,
    requiresCustomerCommercialApproval: true,
  },
  {
    ...baseRule,
    ruleKey: "cabinet-clean-tradeoff",
    taskId: "inside_cabinet_cleaning",
    decisionState: "TRADE_OFF_REQUIRED" as const,
    durationDeltaMinutes: 0,
    priceDeltaMinor: 0,
    removableTaskIds: ["floor_cleaning_standard"],
  },
  {
    ...baseRule,
    ruleKey: "wardrobe-not-supported",
    taskId: "wardrobe_assembly",
    decisionState: "NOT_SUPPORTED" as const,
    durationDeltaMinutes: 0,
    priceDeltaMinor: 0,
  },
  {
    ...baseRule,
    ruleKey: "exposed-wire-escalation",
    taskId: "exposed_live_wire_response",
    decisionState: "SAFETY_ESCALATION" as const,
    durationDeltaMinutes: 0,
    priceDeltaMinor: 0,
    requiresHumanReview: true,
  },
];
