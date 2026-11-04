import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FoundationEntry from "./FoundationEntry";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const verified = { data: [{ environment: "development", target_ref: "local", schema_version: "ordo-foundation-v1" }], error: null };
const clients: QueryClient[] = [];
const businessRender = vi.fn();
function BusinessProbe() { businessRender(); return <h1>Studio content</h1>; }
function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(queryClient);
  return render(<QueryClientProvider client={queryClient}><FoundationEntry><BusinessProbe /></FoundationEntry></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe("foundation server identity gate", () => {
  it("does not mount business queries while server identity is unverified", async () => {
    let finish: (value: typeof verified) => void;
    rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Opening Ordo");
    expect(businessRender).not.toHaveBeenCalled();
    finish!(verified);
    expect(await screen.findByRole("heading", { name: "Studio content" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("foundation_environment_info");
  });

  it.each([
    [],
    [{ environment: "production", target_ref: "local", schema_version: "ordo-foundation-v1" }],
    [{ environment: "development", target_ref: "unknown", schema_version: "ordo-foundation-v1" }],
    [{ environment: "development", target_ref: "local", schema_version: "unknown" }],
  ])("withholds business content for an unexpected identity %j", async identity => {
    rpc.mockResolvedValue({ data: identity, error: null });
    show();
    expect(await screen.findByRole("heading", { name: "This workspace is unavailable" })).toBeInTheDocument();
    expect(businessRender).not.toHaveBeenCalled();
  });

  it("recovers from a transport failure only after successful identity verification", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("offline") }).mockResolvedValueOnce(verified);
    show();
    await screen.findByRole("heading", { name: "This workspace is unavailable" });
    expect(businessRender).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Studio content" })).toBeInTheDocument();
  });
});
