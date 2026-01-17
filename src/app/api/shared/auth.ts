import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkPermission, type PermissionCheckOptions, type PermissionCheckResult } from './rbac';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface AuthResult {
  error: NextResponse | null;
  user: {
    id: string;
    email: string | undefined;
  } | null;
  profile: Profile | null;
  supabase: ReturnType<typeof createSupabaseClient<Database>> | null;
  permission?: PermissionCheckResult;
}

/**
 * Unified authentication helper that supports both:
 * - Bearer token authentication (for Flutter/mobile apps)
 * - Cookie-based authentication (for React/web apps)
 */
export async function authenticateAndAuthorize(
  request: NextRequest,
  permissionOptions?: PermissionCheckOptions
): Promise<AuthResult> {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not set');
      return {
        error: NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 500 }
        ),
        user: null,
        profile: null,
        supabase: null,
      };
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
      return {
        error: NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 500 }
        ),
        user: null,
        profile: null,
        supabase: null,
      };
    }

    // Create a simple Supabase client for token validation
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // First, try Bearer token authentication (for Flutter app)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        // Validate the token
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (!userError && user) {
          // Create SSR client with custom cookie adapter that uses the Bearer token
          // This ensures auth.uid() works in RLS policies
          const supabaseWithRLS = createServerClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() {
                  // Return the access token as a cookie-like structure
                  return [
                    {
                      name: 'sb-access-token',
                      value: token,
                    },
                  ];
                },
                setAll() {
                  // No-op for Bearer token auth - we don't set cookies
                },
              },
              global: {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            }
          );

          // Get user profile
          const { data: profile, error: profileError } = await supabaseWithRLS
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError || !profile) {
            return {
              error: NextResponse.json(
                { success: false, error: 'User profile not found' },
                { status: 404 }
              ),
              user: null,
              profile: null,
              supabase: null,
            };
          }

          // If permission options are provided, check permissions
          if (permissionOptions) {
            const permissionCheck = await checkPermission(
              supabaseWithRLS,
              user.id,
              profile,
              permissionOptions
            );

            if (!permissionCheck.hasPermission) {
              return {
                error: NextResponse.json(
                  {
                    success: false,
                    error: 'Permission denied',
                    reason: permissionCheck.reason,
                    required_permission: {
                      resource: permissionOptions.resource,
                      action: permissionOptions.action,
                    },
                  },
                  { status: 403 }
                ),
                user: null,
                profile: null,
                supabase: null,
                permission: permissionCheck,
              };
            }

            return {
              error: null,
              user: { id: user.id, email: user.email },
              profile,
              supabase: supabaseWithRLS,
              permission: permissionCheck,
            };
          }

          return {
            error: null,
            user: { id: user.id, email: user.email },
            profile,
            supabase: supabaseWithRLS,
          };
        }
      } catch (e) {
        // Bearer token authentication failed, falling back to cookie
        console.log('Bearer token auth failed, falling back to cookie auth');
      }
    }

    // Fallback to cookie-based authentication (for web app)
    const cookieStore = await cookies();

    // Use Supabase SSR client with cookie adapter so auth.uid() works in RLS
    const supabaseWithRLS = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Read current session from cookies
    const {
      data: { session },
      error: sessionError,
    } = await supabaseWithRLS.auth.getSession();

    if (sessionError || !session) {
      return {
        error: NextResponse.json(
          { success: false, error: 'No auth session found' },
          { status: 401 }
        ),
        user: null,
        profile: null,
        supabase: null,
      };
    }

    // Verify the user
    const {
      data: { user },
      error: userError,
    } = await supabaseWithRLS.auth.getUser();

    if (userError || !user) {
      return {
        error: NextResponse.json(
          { success: false, error: 'User validation failed' },
          { status: 401 }
        ),
        user: null,
        profile: null,
        supabase: null,
      };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseWithRLS
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        error: NextResponse.json(
          { success: false, error: 'User profile not found' },
          { status: 404 }
        ),
        user: null,
        profile: null,
        supabase: null,
      };
    }

    // If permission options are provided, check permissions
    if (permissionOptions) {
      const permissionCheck = await checkPermission(
        supabaseWithRLS,
        user.id,
        profile,
        permissionOptions
      );

      if (!permissionCheck.hasPermission) {
        return {
          error: NextResponse.json(
            {
              success: false,
              error: 'Permission denied',
              reason: permissionCheck.reason,
              required_permission: {
                resource: permissionOptions.resource,
                action: permissionOptions.action,
              },
            },
            { status: 403 }
          ),
          user: null,
          profile: null,
          supabase: null,
          permission: permissionCheck,
        };
      }

      return {
        error: null,
        user: { id: user.id, email: user.email },
        profile,
        supabase: supabaseWithRLS,
        permission: permissionCheck,
      };
    }

    return {
      error: null,
      user: { id: user.id, email: user.email },
      profile,
      supabase: supabaseWithRLS,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 }
      ),
      user: null,
      profile: null,
      supabase: null,
    };
  }
}

/**
 * Helper to check if a request is using Bearer token authentication
 */
export function isBearerTokenAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return !!(authHeader && authHeader.startsWith('Bearer '));
}
