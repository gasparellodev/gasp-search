import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => ({
  callbacks: [] as Array<(payload: { payload: unknown }) => void>,
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
  client: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => realtime.client,
}));

import { ConversationThread } from "@/components/messages/conversation-thread";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  realtime.callbacks.length = 0;
  realtime.channel.on.mockReset();
  realtime.channel.subscribe.mockReset();
  realtime.client.channel.mockReset();
  realtime.client.removeChannel.mockReset();
  realtime.channel.on.mockImplementation((type, filter, cb) => {
    if (type === "broadcast" && filter?.event === "presence") {
      realtime.callbacks.push(cb);
    }
    return realtime.channel;
  });
  realtime.channel.subscribe.mockReturnValue(realtime.channel);
  realtime.client.channel.mockReturnValue(realtime.channel);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ConversationThread", () => {
  it("carrega presença inicial e mostra digitando via broadcast", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            {
              id: "m1",
              lead_id: "lead-1",
              channel: "whatsapp",
              tone: null,
              content: "Oi",
              created_at: "2026-05-12T12:00:00Z",
              direction: "inbound",
              status: "delivered",
              whatsapp_msg_id: "evo-1",
              campaign_id: null,
              ai_generated: false,
              error_message: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          presence: "online",
          lastSeen: "2026-05-12T12:00:00.000Z",
        }),
      );

    render(<ConversationThread leadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByText(/online agora/i)).toBeInTheDocument();
    });
    expect(realtime.client.channel).toHaveBeenCalledWith(
      "whatsapp-presence:lead-1",
    );

    realtime.callbacks[0]?.({
      payload: {
        leadId: "lead-1",
        presence: "typing",
        lastSeen: "2026-05-12T12:00:05.000Z",
      },
    });

    expect(await screen.findByText(/digitando/i)).toBeInTheDocument();
  });
});
