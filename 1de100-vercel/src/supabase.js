import { createClient } from "@supabase/supabase-js";

// ─── Supabase Config ───
// Replace these with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth helpers ───
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Profile helpers ───
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { data, error };
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  return { data, error };
}

export async function uploadAvatar(userId, file) {
  const ext = file.name?.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await updateProfile(userId, { avatar_url: data.publicUrl });
  return { url: data.publicUrl, error: null };
}

// ─── Activity helpers ───
export async function logActivity(userId, exerciseId, reps) {
  const { data, error } = await supabase
    .from("activities")
    .insert({ user_id: userId, exercise_id: exerciseId, reps })
    .select()
    .single();
  return { data, error };
}

export async function getTodayActivities(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .eq("day", today)
    .order("logged_at", { ascending: false });
  return { data: data || [], error };
}

export async function getActivitiesForRange(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .gte("day", startDate)
    .lte("day", endDate)
    .order("day", { ascending: false });
  return { data: data || [], error };
}

// ─── Daily Photo helpers ───
export async function uploadDailyPhoto(userId, file) {
  const today = new Date().toISOString().slice(0, 10);
  const path = `${userId}/${today}.jpg`;
  const { error } = await supabase.storage.from("daily-photos").upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: urlData } = supabase.storage.from("daily-photos").getPublicUrl(path);
  // Upsert to daily_photos table
  await supabase.from("daily_photos").upsert({
    user_id: userId,
    day: today,
    photo_url: urlData.publicUrl,
  }, { onConflict: "user_id,day" });
  return { url: urlData.publicUrl, error: null };
}

export async function getDailyPhotos(userId) {
  const { data, error } = await supabase
    .from("daily_photos")
    .select("*")
    .eq("user_id", userId)
    .order("day", { ascending: false });
  return { data: data || [], error };
}

// ─── Friendship helpers ───
export async function sendFriendRequest(fromUserId, toEmail) {
  // Find user by email via profiles — we need a lookup
  // First find the user
  const { data: users } = await supabase.rpc("find_user_by_email", { user_email: toEmail });
  if (!users || users.length === 0) return { error: { message: "Usuario no encontrado" } };
  const toUserId = users[0].id;
  if (toUserId === fromUserId) return { error: { message: "No puedes añadirte a ti mismo" } };

  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: fromUserId, addressee_id: toUserId })
    .select()
    .single();
  return { data, error };
}

export async function respondFriendRequest(friendshipId, accept) {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", friendshipId)
    .select()
    .single();
  return { data, error };
}

export async function getFriends(userId) {
  const { data, error } = await supabase.rpc("get_friends", { uid: userId });
  return { data: data || [], error };
}

export async function getPendingRequests(userId) {
  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!requester_id(display_name, avatar_url)")
    .eq("addressee_id", userId)
    .eq("status", "pending");
  return { data: data || [], error };
}

// ─── Challenge helpers ───
export async function createChallenge(creatorId, title, exerciseId, targetReps, deadline, stake, invitedFriendIds) {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({ creator_id: creatorId, title, exercise_id: exerciseId, target_reps: targetReps, deadline, stake })
    .select()
    .single();
  if (error) return { data: null, error };

  // Add creator as participant
  const participants = [{ challenge_id: challenge.id, user_id: creatorId }];
  // Add invited friends
  for (const fid of invitedFriendIds) {
    participants.push({ challenge_id: challenge.id, user_id: fid });
  }
  await supabase.from("challenge_participants").insert(participants);
  return { data: challenge, error: null };
}

export async function getMyChallenges(userId) {
  const { data, error } = await supabase
    .from("challenge_participants")
    .select(`
      *,
      challenge:challenges(*,
        creator:profiles!creator_id(display_name, avatar_url)
      )
    `)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  return { data: data || [], error };
}

export async function getChallengeLeaderboard(challengeId) {
  const { data, error } = await supabase
    .from("challenge_participants")
    .select("*, user:profiles(display_name, avatar_url)")
    .eq("challenge_id", challengeId)
    .order("current_reps", { ascending: false });
  return { data: data || [], error };
}

// ─── Push Notification helpers ───
export async function savePushSubscription(userId, subscription) {
  return updateProfile(userId, { push_subscription: subscription });
}

export async function removePushSubscription(userId) {
  return updateProfile(userId, { push_subscription: null });
}
