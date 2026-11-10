export const keys = {
  organizations: (accountId: string) => ["foundation", accountId, "organizations"] as const,
  projects: (accountId: string, organizationId: string) => ["foundation", accountId, organizationId, "projects"] as const,
  project: (accountId: string, organizationId: string, projectId: string) => ["foundation", accountId, organizationId, "project", projectId] as const,
  clients: (accountId: string, organizationId: string) => ["foundation", accountId, organizationId, "clients"] as const,
  initiatives: (accountId: string, organizationId: string) => ["foundation", accountId, organizationId, "initiatives"] as const,
};
