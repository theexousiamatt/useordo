import type { QueryClient } from "@tanstack/react-query";
/** All views invalidate the same canonical records, scoped to the current account/studio. */
export function invalidateTaskViews(client:QueryClient,accountId:string,organizationId:string) {
 return client.invalidateQueries({queryKey:["foundation",accountId,organizationId],predicate:query=>["production","my-tasks","task-context"].includes(String(query.queryKey[3]))});
}
