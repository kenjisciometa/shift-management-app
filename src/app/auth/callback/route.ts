import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  // Handle auth errors (e.g., expired link)
  if (error || errorCode) {
    const errorParams = new URLSearchParams();
    if (error) errorParams.set("error", error);
    if (errorCode) errorParams.set("error_code", errorCode);
    if (errorDescription) errorParams.set("error_description", errorDescription);
    return NextResponse.redirect(`${origin}/login?${errorParams.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      const errorParams = new URLSearchParams();
      errorParams.set("error", "auth_error");
      errorParams.set("error_description", authError.message);
      return NextResponse.redirect(`${origin}/login?${errorParams.toString()}`);
    }

    if (authData?.user) {
      // Check if user has a profile with an organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", authData.user.id)
        .single();

      // If no profile or no organization, redirect to onboarding
      if (!profile?.organization_id) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/dashboard`);
}
