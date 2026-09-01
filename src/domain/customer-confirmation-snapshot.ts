export type SnapshotTask = Readonly<{ taskId: string; displayName: string }>;

export function buildConfirmationTaskLists(input: {
  includedTaskIds: readonly string[];
  catalogue: readonly (SnapshotTask & { active?: boolean })[];
  selectedTask: SnapshotTask;
}) {
  const includedTasks = input.includedTaskIds.map((taskId) => {
    const task = input.catalogue.find(
      (candidate) => candidate.taskId === taskId && candidate.active !== false,
    );
    if (!task) throw new Error("Confirmation snapshot inputs are unavailable.");
    return { taskId: task.taskId, displayName: task.displayName };
  });
  const resultingTasks = includedTasks.some(
    (task) => task.taskId === input.selectedTask.taskId,
  )
    ? includedTasks
    : [
        ...includedTasks,
        {
          taskId: input.selectedTask.taskId,
          displayName: input.selectedTask.displayName,
        },
      ];
  return { includedTasks, resultingTasks };
}

export function confirmationExpiresAt(createdAt: string): string {
  return new Date(Date.parse(createdAt) + 30 * 60 * 1000).toISOString();
}

export function validateConfirmationCreation(input: {
  createdAt: string;
  requestedExpiresAt: string;
  tokenHash: string;
  incidentStatus: string;
  supportState: string;
  decisionState: string;
  requiresCustomer: boolean;
}): string {
  const expiresAt = confirmationExpiresAt(input.createdAt);
  if (Math.abs(Date.parse(input.requestedExpiresAt) - Date.parse(expiresAt)) > 5_000) {
    throw new Error("Confirmation must expire exactly 30 minutes after creation.");
  }
  if (!/^[a-f0-9]{64}$/.test(input.tokenHash)) {
    throw new Error("Invalid confirmation token hash.");
  }
  if (
    input.incidentStatus !== "DECISION_READY" ||
    input.supportState !== "SUPPORTED" ||
    input.decisionState !== "ADD_ON_APPROVAL_REQUIRED" ||
    !input.requiresCustomer
  ) {
    throw new Error("Decision does not support customer confirmation.");
  }
  return expiresAt;
}

export function buildConfirmationSnapshot(input: {
  bookingKey: string;
  serviceName: string;
  includedTaskIds: readonly string[];
  catalogue: readonly (SnapshotTask & { active?: boolean })[];
  selectedTask: SnapshotTask;
  durationDeltaMinutes?: number;
  priceDeltaMinor?: number;
  currency: string;
  removableTaskIds: readonly string[];
  source: { sourceKey: string; title: string; version: string };
}) {
  const taskLists = buildConfirmationTaskLists(input);
  return {
    bookingKey: input.bookingKey,
    serviceName: input.serviceName,
    ...taskLists,
    taskId: input.selectedTask.taskId,
    taskDisplayName: input.selectedTask.displayName,
    decisionState: "ADD_ON_APPROVAL_REQUIRED" as const,
    durationDeltaMinutes: input.durationDeltaMinutes ?? 0,
    priceDeltaMinor: input.priceDeltaMinor ?? 0,
    currency: input.currency,
    removableTaskIds: [...input.removableTaskIds],
    sourceKey: input.source.sourceKey,
    sourceTitle: input.source.title,
    sourceVersion: input.source.version,
  };
}
