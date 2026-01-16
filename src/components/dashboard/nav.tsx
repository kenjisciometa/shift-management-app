"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { Database } from "@/types/database.types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  FileText,
  Settings,
  ChevronUp,
  LogOut,
  User as UserIcon,
  Building2,
  ClipboardList,
  Palmtree,
  BarChart3,
  ClipboardPen,
  ArrowRightLeft,
} from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations: Database["public"]["Tables"]["organizations"]["Row"] | null;
};

interface DashboardNavProps {
  user: {
    id: string;
    email: string | undefined;
  };
  profile: Profile | null;
}

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: Calendar,
  },
  {
    title: "Timesheets",
    href: "/timesheets",
    icon: FileText,
  },
  {
    title: "PTO",
    href: "/pto",
    icon: Palmtree,
  },
  {
    title: "Shift Swaps",
    href: "/shift-swaps",
    icon: ArrowRightLeft,
  },
];

const teamNavItems = [
  {
    title: "Team",
    href: "/team",
    icon: Users,
  },
  {
    title: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ClipboardList,
  },
  {
    title: "Forms",
    href: "/forms",
    icon: ClipboardPen,
  },
];

const adminNavItems = [
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Organization",
    href: "/organization",
    icon: Building2,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function DashboardNav({ user, profile }: DashboardNavProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "U";
  };

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return user.email || "User";
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground overflow-hidden">
            {profile?.organizations?.logo_url ? (
              <Image
                src={profile.organizations.logo_url}
                alt={profile.organizations.name || "Organization logo"}
                fill
                className="object-cover"
              />
            ) : (
              <Clock className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {profile?.organizations?.name || "Shift Manager"}
            </span>
            <span className="text-xs text-muted-foreground">
              Shift Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Team</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teamNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={profile?.avatar_url || undefined}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium truncate max-w-[140px]">
                        {getDisplayName()}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {user.email}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action="/api/auth/signout" method="post">
                      <button
                        type="submit"
                        className="flex w-full items-center text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton className="w-full">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {getDisplayName()}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {user.email}
                  </span>
                </div>
                <ChevronUp className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
