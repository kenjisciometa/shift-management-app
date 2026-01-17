import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ChangeEmailRequest {
  new_email: string;
  password: string;
}

/**
 * PUT /api/profile/email
 * Request email change for the current user
 * Supabase will send confirmation emails to both old and new addresses
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChangeEmailRequest = await request.json();
    const { new_email, password } = body;

    if (!new_email || !password) {
      return NextResponse.json(
        { error: "New email and password are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (new_email.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      );
    }

    // Verify password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 400 }
      );
    }

    // Get app URL for redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;

    // Request email change - Supabase sends confirmation to both addresses
    const { error: updateError } = await supabase.auth.updateUser(
      { email: new_email.toLowerCase() },
      { emailRedirectTo: `${appUrl}/auth/callback?redirect_to=/profile` }
    );

    if (updateError) {
      console.error("Error requesting email change:", updateError);

      // Handle specific error cases
      if (updateError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "This email is already registered to another account" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to request email change" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Confirmation email sent. Please check both your current and new email addresses to confirm the change.",
    });
  } catch (error) {
    console.error("Error in PUT /api/profile/email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
