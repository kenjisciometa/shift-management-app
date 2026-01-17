import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5MB

/**
 * POST /api/organization/logo
 * Upload organization logo
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

    // Check if user is admin
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = profile.organization_id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FORMATS.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload JPG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 3.5MB limit." },
        { status: 400 }
      );
    }

    // Get current organization to check for existing logo
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("logo_url")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch organization" },
        { status: 500 }
      );
    }

    // Delete old logo if exists
    if (org.logo_url) {
      const oldPath = org.logo_url.split("/organization-logos/")[1];
      if (oldPath) {
        await supabase.storage.from("organization-logos").remove([oldPath]);
      }
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${organizationId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload new logo
    const { error: uploadError } = await supabase.storage
      .from("organization-logos")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("organization-logos")
      .getPublicUrl(filePath);

    const newLogoUrl = urlData.publicUrl;

    // Update organization record
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ logo_url: newLogoUrl })
      .eq("id", organizationId);

    if (updateError) {
      console.error("Error updating organization:", updateError);
      // Try to clean up uploaded file
      await supabase.storage.from("organization-logos").remove([filePath]);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logo_url: newLogoUrl,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/organization/logo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/logo
 * Remove organization logo
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

    // Check if user is admin
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = profile.organization_id;

    // Get current organization logo
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("logo_url")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch organization" },
        { status: 500 }
      );
    }

    if (!org.logo_url) {
      return NextResponse.json({
        success: true,
        message: "No logo to remove",
      });
    }

    // Delete from storage
    const oldPath = org.logo_url.split("/organization-logos/")[1];
    if (oldPath) {
      const { error: deleteError } = await supabase.storage
        .from("organization-logos")
        .remove([oldPath]);

      if (deleteError) {
        console.error("Error deleting logo from storage:", deleteError);
        // Continue to update the record even if storage delete fails
      }
    }

    // Update organization record
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ logo_url: null })
      .eq("id", organizationId);

    if (updateError) {
      console.error("Error updating organization:", updateError);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Logo removed successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/organization/logo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
