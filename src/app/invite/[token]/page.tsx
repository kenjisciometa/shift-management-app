import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AcceptInvitation } from "@/components/invite/accept-invitation";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Check if user is already logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get invitation by token
  const { data: invitation, error } = await supabase
    .from("employee_invitations")
    .select(`
      *,
      organizations (id, name, logo_url)
    `)
    .eq("token", token)
    .single();

  // Handle invalid or expired invitation
  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">
            This invitation link is invalid or has been revoked.
          </p>
          <a
            href="/login"
            className="text-primary hover:underline"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Check if invitation is expired
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Invitation Expired</h1>
          <p className="text-muted-foreground mb-6">
            This invitation has expired. Please contact your administrator for a new invitation.
          </p>
          <a
            href="/login"
            className="text-primary hover:underline"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Check if invitation is already used
  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Invitation Already Used</h1>
          <p className="text-muted-foreground mb-6">
            This invitation has already been accepted.
          </p>
          <a
            href="/login"
            className="text-primary hover:underline"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // If user is logged in, check if email matches
  if (user && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Wrong Account</h1>
          <p className="text-muted-foreground mb-6">
            This invitation is for {invitation.email}. Please sign in with that email address.
          </p>
          <a
            href="/api/auth/signout"
            className="text-primary hover:underline"
          >
            Sign out and try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <AcceptInvitation
        invitation={invitation}
        isLoggedIn={!!user}
      />
    </div>
  );
}
