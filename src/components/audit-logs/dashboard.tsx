"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Shield,
  User,
  Calendar,
  Clock,
  FileText,
  UserCog,
  Briefcase,
  CheckSquare,
} from "lucide-react";

import type { Json } from "@/types/database.types";

type AuditLog = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  metadata: Json | null;
  created_at: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};

interface AuditLogsDashboardProps {
  auditLogs: AuditLog[];
}

const actionLabels: Record<string, { label: string; color: string }> = {
  profile_updated: { label: "Profile Updated", color: "bg-blue-100 text-blue-800" },
  shift_created: { label: "Shift Created", color: "bg-green-100 text-green-800" },
  shift_updated: { label: "Shift Updated", color: "bg-yellow-100 text-yellow-800" },
  shift_deleted: { label: "Shift Deleted", color: "bg-red-100 text-red-800" },
  pto_status_changed: { label: "PTO Status Changed", color: "bg-purple-100 text-purple-800" },
  task_created: { label: "Task Created", color: "bg-green-100 text-green-800" },
  task_updated: { label: "Task Updated", color: "bg-yellow-100 text-yellow-800" },
  login: { label: "Login", color: "bg-gray-100 text-gray-800" },
  logout: { label: "Logout", color: "bg-gray-100 text-gray-800" },
};

const entityIcons: Record<string, React.ElementType> = {
  profile: User,
  shift: Calendar,
  pto_request: Briefcase,
  task: CheckSquare,
  time_entry: Clock,
};

export function AuditLogsDashboard({ auditLogs }: AuditLogsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");

  // Get unique actions and entities for filters
  const uniqueActions = [...new Set(auditLogs.map((log) => log.action))];
  const uniqueEntities = [...new Set(auditLogs.map((log) => log.entity_type))];

  // Filter logs
  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterEntity !== "all" && log.entity_type !== filterEntity) return false;
    if (searchQuery) {
      const userName = getDisplayName(log.profiles);
      const searchLower = searchQuery.toLowerCase();
      return (
        userName.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.entity_type.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  function getDisplayName(profile: AuditLog["profiles"]) {
    if (!profile) return "System";
    if (profile.display_name) return profile.display_name;
    return `${profile.first_name} ${profile.last_name}`;
  }

  function formatChanges(oldValues: Json | null, newValues: Json | null) {
    const changes: string[] = [];

    const oldObj = oldValues && typeof oldValues === "object" && !Array.isArray(oldValues) ? oldValues : null;
    const newObj = newValues && typeof newValues === "object" && !Array.isArray(newValues) ? newValues : null;

    if (oldObj && newObj) {
      Object.keys(newObj).forEach((key) => {
        if (oldObj[key] !== newObj[key]) {
          changes.push(`${key}: ${oldObj[key]} -> ${newObj[key]}`);
        }
      });
    } else if (newObj) {
      Object.entries(newObj).forEach(([key, value]) => {
        changes.push(`${key}: ${value}`);
      });
    }

    return changes;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Audit Logs</CardTitle>
          </div>
          <CardDescription>
            Track and review all important actions in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {actionLabels[action]?.label || action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {uniqueEntities.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {filteredLogs.length > 0 ? (
              <div className="divide-y">
                {filteredLogs.map((log) => {
                  const EntityIcon = entityIcons[log.entity_type] || FileText;
                  const actionInfo = actionLabels[log.action] || {
                    label: log.action,
                    color: "bg-gray-100 text-gray-800",
                  };
                  const changes = formatChanges(log.old_values, log.new_values);
                  const targetUser = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
                    ? String((log.metadata as Record<string, unknown>).target_user || "")
                    : "";

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <EntityIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={actionInfo.color}>
                            {actionInfo.label}
                          </Badge>
                          <Badge variant="outline">
                            {log.entity_type.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">
                          <span className="font-medium">
                            {getDisplayName(log.profiles)}
                          </span>
                          {" performed "}
                          <span className="text-muted-foreground">
                            {log.action.replace("_", " ")}
                          </span>
                          {targetUser && (
                            <>
                              {" on "}
                              <span className="font-medium">{targetUser}</span>
                            </>
                          )}
                        </p>
                        {changes.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
                            {changes.map((change, i) => (
                              <div key={i}>{change}</div>
                            ))}
                          </div>
                        )}
                        {log.created_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(parseISO(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || filterAction !== "all" || filterEntity !== "all"
                    ? "No logs match your filters"
                    : "No audit logs yet"}
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
