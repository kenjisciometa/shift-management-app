import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import type { Json } from "@/types/database.types";

/**
 * GET /api/notifications
 * Get notifications for the current user
 *
 * Query params:
 * - is_read: boolean (optional)
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
 */
export async function GET(request: NextRequest) {
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
    const isRead = searchParams.get("is_read");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (isRead !== null) {
      query = query.eq("is_read", isRead === "true");
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        notifications: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
        unread_count: isRead === null
          ? (data || []).filter((n) => !n.is_read).length
          : undefined,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a notification (internal use)
 *
 * Body:
 * - user_id: string (required)
 * - type: string (required)
 * - title: string (required)
 * - body: string (optional)
 * - data: object (optional)
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

    const body = await request.json();
    const { user_id, type, title, body: notificationBody, data } = body;

    if (!user_id || !type || !title) {
      return NextResponse.json(
        { error: "user_id, type, and title are required" },
        { status: 400 }
      );
    }

    // Verify target user belongs to same organization
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    if (targetUser.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Cannot send notifications to users outside your organization" },
        { status: 403 }
      );
    }

    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        organization_id: profile.organization_id,
        type,
        title,
        body: notificationBody || null,
        data: (data as Json) || null,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return NextResponse.json(
        { error: "Failed to create notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
