import { supabase } from "./supabase";

export type DbChannel = {
  id: string;
  name: string;
  all_members: boolean;
  created_at: string;
};

export type DbChannelMember = {
  id: string;
  channel_id: string;
  employee_id: string;
};

const CHANNEL_COLS = "id,name,all_members,created_at";
const MEMBER_COLS = "id,channel_id,employee_id";
// Ships in migration 0037 — reach the tables untyped until Lovable regenerates DB types.
const channelsTable = () => (supabase as unknown as { from: (t: string) => any }).from("team_channels");
const membersTable = () => (supabase as unknown as { from: (t: string) => any }).from("team_channel_members");

export async function listChannels(orgId: string): Promise<DbChannel[]> {
  const { data, error } = await channelsTable().select(CHANNEL_COLS).eq("org_id", orgId).order("created_at", { ascending: true });
  if (error) return [];
  return (data as DbChannel[]) ?? [];
}

export async function createChannel(orgId: string, name: string, allMembers: boolean) {
  const { data, error } = await channelsTable().insert({ org_id: orgId, name, all_members: allMembers }).select(CHANNEL_COLS).single();
  return { data: data as DbChannel | null, error: error ? new Error(error.message) : null };
}

export async function renameChannel(id: string, name: string) {
  const { error } = await channelsTable().update({ name }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function setChannelAudience(id: string, allMembers: boolean) {
  const { error } = await channelsTable().update({ all_members: allMembers }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** All channel memberships for an org, one flat list (filter client-side per channel). */
export async function listChannelMembers(orgId: string): Promise<DbChannelMember[]> {
  const { data, error } = await membersTable().select(MEMBER_COLS).eq("org_id", orgId);
  if (error) return [];
  return (data as DbChannelMember[]) ?? [];
}

export async function addChannelMember(orgId: string, channelId: string, employeeId: string) {
  const { error } = await membersTable().upsert(
    { org_id: orgId, channel_id: channelId, employee_id: employeeId },
    { onConflict: "channel_id,employee_id", ignoreDuplicates: true },
  );
  return { error: error ? new Error(error.message) : null };
}

export async function removeChannelMember(id: string) {
  const { error } = await membersTable().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
