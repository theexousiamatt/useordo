import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNotifications } from "./useNotifications";

const mock = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn().mockResolvedValue(undefined),
  from: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "workspace-1" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: mock,
}));

function Subscriber() {
  useNotifications();
  return null;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("notification realtime subscriptions", () => {
  it("uses a distinct channel topic when header and Inbox mount concurrently", () => {
    mock.channel.mockImplementation(() => {
      const channel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      return channel;
    });
    mock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Subscriber />
        <Subscriber />
      </QueryClientProvider>,
    );

    expect(mock.channel).toHaveBeenCalledTimes(2);
    const topics = mock.channel.mock.calls.map(args => args[0]);
    expect(topics[0]).toMatch(/^notifications-user-1-workspace-1-/);
    expect(topics[1]).toMatch(/^notifications-user-1-workspace-1-/);
    expect(new Set(topics).size).toBe(2);
  });
});
