"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Plus, ClipboardList, Eye } from "lucide-react";
import { FormBuilderDialog } from "./builder-dialog";
import { FormFillDialog } from "./fill-dialog";
import { FormViewDialog } from "./view-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type FormTemplate = Database["public"]["Tables"]["form_templates"]["Row"];
type FormSubmission = Database["public"]["Tables"]["form_submissions"]["Row"] & {
  form_templates: { id: string; name: string } | null;
};
type AllFormSubmission = FormSubmission & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface FormsDashboardProps {
  profile: Profile;
  templates: FormTemplate[];
  mySubmissions: FormSubmission[];
  allSubmissions: AllFormSubmission[];
  isAdmin: boolean;
}

export function FormsDashboard({
  profile,
  templates,
  mySubmissions,
  allSubmissions,
  isAdmin,
}: FormsDashboardProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | AllFormSubmission | null>(null);

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setBuilderOpen(true);
  };

  const handleEditTemplate = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setBuilderOpen(true);
  };

  const handleFillForm = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setFillOpen(true);
  };

  const handleViewSubmission = (submission: FormSubmission | AllFormSubmission) => {
    setSelectedSubmission(submission);
    setViewOpen(true);
  };

  const getDisplayName = (p: { first_name: string; last_name: string; display_name: string | null } | null) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (p: { first_name: string; last_name: string } | null) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <Button onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form Template
          </Button>
        )}
      </div>

      <Tabs defaultValue={isAdmin ? "all-submissions" : "templates"}>
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="all-submissions">All Submissions</TabsTrigger>
          )}
          <TabsTrigger value="templates">Form Templates</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {templates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const fields = (template.fields as Array<{ label: string }>) || [];
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                      {template.description && (
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          {fields.length} field{fields.length !== 1 ? "s" : ""}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => handleFillForm(template)}
                        >
                          <ClipboardList className="h-4 w-4 mr-2" />
                          Fill Out Form
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No form templates</p>
                {isAdmin && (
                  <Button
                    variant="link"
                    onClick={handleCreateTemplate}
                    className="mt-2"
                  >
                    Create your first form template
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {mySubmissions.length > 0 ? (
            <div className="space-y-4">
              {mySubmissions.map((submission) => (
                <Card key={submission.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {submission.form_templates?.name || "Unknown Form"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Submitted{" "}
                          {submission.submitted_at
                            ? format(parseISO(submission.submitted_at), "MMM d, yyyy h:mm a")
                            : format(parseISO(submission.created_at!), "MMM d, yyyy h:mm a")}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSubmission(submission)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No form submissions yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all-submissions" className="mt-4">
            {allSubmissions.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={submission.profiles?.avatar_url || undefined}
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(submission.profiles)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {getDisplayName(submission.profiles)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {submission.form_templates?.name || "Unknown Form"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {submission.submitted_at
                            ? format(parseISO(submission.submitted_at), "MMM d, yyyy h:mm a")
                            : format(parseISO(submission.created_at!), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewSubmission(submission)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No form submissions from employees yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Form Builder Dialog */}
      <FormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        template={selectedTemplate}
        organizationId={profile.organization_id}
      />

      {/* Form Fill Dialog */}
      <FormFillDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        template={selectedTemplate}
        profile={profile}
      />

      {/* View Submission Dialog */}
      <FormViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        submission={selectedSubmission}
      />
    </div>
  );
}
