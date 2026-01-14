"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const scheduleTabs = [
  { value: "full", label: "Full Schedule" },
  { value: "my-locations", label: "My Locations" },
  { value: "my-schedule", label: "My Schedule" },
  { value: "pending", label: "Pending Approval" },
  { value: "unavailability", label: "Unavailability" },
];

interface ScheduleHeaderProps {
  isAdmin?: boolean;
}

export function ScheduleHeader({ isAdmin = false }: ScheduleHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "full";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/schedule?${params.toString()}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          {scheduleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
  );
}
