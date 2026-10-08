import { createClient } from "npm:@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanRequest {
  name: string;
  description?: string;
  start_date?: string | null;
  due_date?: string | null;
  generate: { tasks: boolean; milestones: boolean; timeline: boolean };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth, error: authError } = await admin.auth.getUser(token ?? "");
    if (!token || authError || !auth.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = (await req.json()) as PlanRequest & { workspaceId?: string };
    if (!body.workspaceId || !body.generate || typeof body.name !== "string" || body.name.length > 200 || (body.description?.length ?? 0) > 5000) {
      return new Response(JSON.stringify({ error: "Invalid planning request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: allowed } = await admin.rpc("is_workspace_collaborator", { _workspace_id: body.workspaceId, _user_id: auth.user.id });
    if (!allowed) return new Response(JSON.stringify({ error: "Workspace access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const apiKey = Deno.env.get("AI_API_KEY");
    const apiUrl = Deno.env.get("AI_API_URL");
    const model = Deno.env.get("AI_MODEL");
    if (!apiKey || !apiUrl || !model) {
      return new Response(JSON.stringify({ error: "AI planning is not configured yet. Create your plan manually." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: "Project name is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wants: string[] = [];
    if (body.generate.milestones) wants.push("milestones");
    if (body.generate.tasks) wants.push("tasks");
    if (body.generate.timeline) wants.push("a sensible due_offset_days timeline for each item");

    const prompt = `You are a senior project planner. Create a concise, realistic plan for the project below.\n\nProject: ${body.name}\nDescription: ${body.description ?? "(none)"}\nStart date: ${body.start_date ?? "(not set)"}\nDue date: ${body.due_date ?? "(not set)"}\n\nGenerate: ${wants.join(", ")}.\nReturn 3-5 milestones and 6-10 tasks. Keep titles short and professional. Use due_offset_days relative to project start (integer days).`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_plan",
              description: "Submit the generated project plan.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["milestone", "task"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high"] },
                        due_offset_days: { type: "number" },
                      },
                      required: ["type", "title"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_plan" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI gateway error: ${text}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { items: [] };

    return new Response(JSON.stringify({ items: args.items ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-project-plan error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to generate plan." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
