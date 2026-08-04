import type { SupabaseClient } from "@supabase/supabase-js";
import { operationalConfig, type OperationalConfig, type OperationalSettingsRecord } from "./operational-config";
import { getAdminSupabase } from "./supabase";

const settingsColumns = "policy_version,methodology_version,prompt_version,model,form_link_days,report_link_days,review_sla_hours,revision,updated_at";

export async function getOperationalSettingsRecord(admin: SupabaseClient = getAdminSupabase()): Promise<OperationalSettingsRecord> {
  const { data, error } = await admin
    .from("diagnostic_operational_settings")
    .select(settingsColumns)
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as OperationalSettingsRecord;
}

export async function getOperationalConfig(admin: SupabaseClient = getAdminSupabase()): Promise<OperationalConfig> {
  const settings = await getOperationalSettingsRecord(admin);
  return {
    policyVersion: settings.policy_version,
    methodologyVersion: settings.methodology_version,
    promptVersion: settings.prompt_version,
    model: settings.model,
    formLinkDays: settings.form_link_days,
    reportLinkDays: settings.report_link_days,
    reviewSlaHours: settings.review_sla_hours,
  };
}

export async function getOperationalConfigWithFallback(): Promise<OperationalConfig> {
  try {
    return await getOperationalConfig();
  } catch {
    return operationalConfig;
  }
}
