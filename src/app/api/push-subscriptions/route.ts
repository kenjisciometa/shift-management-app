import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * POST /api/push-subscriptions
 * Create or update a push subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const body: PushSubscriptionPayload = await request.json();

    if (!body.endpoint || !body.p256dh || !body.auth) {
      return NextResponse.json(
        { error: "endpoint, p256dh, and auth are required" },
        { status: 400 }
      );
    }

    // Upsert subscription (user_id + endpoint is unique)
    // Note: push_subscriptions table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: upsertError } = await (supabase as any)
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Error saving push subscription:", upsertError);
      return NextResponse.json(
        { error: "Failed to save push subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Push subscription saved",
    });
  } catch (error) {
    console.error("Error in POST /api/push-subscriptions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-subscriptions
 * Remove a push subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint query parameter is required" },
        { status: 400 }
      );
    }

    // Note: push_subscriptions table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (deleteError) {
      console.error("Error deleting push subscription:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete push subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription removed",
    });
  } catch (error) {
    console.error("Error in DELETE /api/push-subscriptions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
