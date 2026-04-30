"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

export type StatusKey =
  | "new"
  | "in_progress"
  | "interested"
  | "follow_up"
  | "not_interested"
  | "won"
  | "lost";

export function useLeadsByStatus(status: StatusKey) {
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("leads")
      .select("*")
      .eq("status", status);

    if (status === "follow_up") {
      q = q.order("follow_up_date", { ascending: true });
    } else if (status === "interested") {
      q = q.order("opportunity_score", { ascending: false });
    } else if (status === "won") {
      q = q.order("deal_closed_at", { ascending: false });
    } else if (status === "new") {
      q = q.order("match_score", { ascending: false }).order("score", { ascending: false });
    } else {
      q = q.order("updated_at", { ascending: false });
    }

    const { data, error } = await q.limit(500);
    if (!error && data) setLeads(data);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { leads, loading, reload };
}

export async function patchLead(id: string, body: Record<string, unknown>): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("אין סשן");
  await apiFetch(`/api/leads/${id}`, session.access_token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function quickStatus(id: string, action: string): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("אין סשן");
  await apiFetch(`/api/leads/${id}/quick-status?action=${action}`, session.access_token, {
    method: "POST",
  });
}

export async function logActivity(
  id: string,
  body: { activity_type: string; outcome?: string; notes?: string }
): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("אין סשן");
  await apiFetch(`/api/leads/${id}/activities`, session.access_token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
