// Supabase Edge Function: invite-friend
// Handles inviting friends by email — if they exist, creates a friend request;
// if not, sends an invitation email to join the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inviteeEmail } = await req.json();

    if (!inviteeEmail || !inviteeEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authenticated user from the JWT
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || "https://1de100.vercel.app";

    // Client with user's JWT (to get who's calling)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get inviter's profile
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.display_name || "Un amigo";

    // Check if invitee is already registered
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === inviteeEmail.toLowerCase()
    );

    if (existingUser) {
      // User exists — check they're not the same person
      if (existingUser.id === user.id) {
        return new Response(
          JSON.stringify({ error: "No puedes invitarte a ti mismo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if friendship already exists
      const { data: existingFriendship } = await supabaseAdmin
        .from("friendships")
        .select("id, status")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${existingUser.id}),and(requester_id.eq.${existingUser.id},addressee_id.eq.${user.id})`)
        .limit(1)
        .single();

      if (existingFriendship) {
        const msg = existingFriendship.status === "accepted"
          ? "Ya sois amigos"
          : "Ya hay una solicitud pendiente";
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create friend request
      await supabaseAdmin.from("friendships").insert({
        requester_id: user.id,
        addressee_id: existingUser.id,
      });

      return new Response(
        JSON.stringify({
          success: true,
          type: "friend_request",
          message: `Solicitud de amistad enviada a ${inviteeEmail}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User does NOT exist — send invitation email
    // Store the invitation
    await supabaseAdmin.from("invitations").upsert({
      inviter_id: user.id,
      invitee_email: inviteeEmail.toLowerCase(),
      status: "pending",
    }, { onConflict: "inviter_id,invitee_email" });

    // Send invite via Supabase Auth (creates account + sends email)
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      inviteeEmail,
      {
        redirectTo: `${siteUrl}`,
        data: {
          display_name: inviteeEmail.split("@")[0],
          invited_by: inviterName,
        },
      }
    );

    if (inviteError) {
      // If user was already invited, that's ok
      if (inviteError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({
            success: true,
            type: "already_invited",
            message: `${inviteeEmail} ya fue invitado. Le hemos reenviado la invitación.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw inviteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: "invitation_sent",
        message: `Invitación enviada a ${inviteeEmail}. Cuando se registre, seréis amigos automáticamente.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
