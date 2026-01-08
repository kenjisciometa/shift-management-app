"use client";

import { format, parseISO } from "date-fns";
import type { Database } from "@/types/database.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type FormTemplate = Database["public"]["Tables"]["form_templates"]["Row"];
type FormSubmission = Database["public"]["Tables"]["form_submissions"]["Row"] & {
  form_templates: { id: string; name: string } | null;
};

interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date";
  label: string;
  required: boolean;
  options?: string[];
}

interface FormViewDialogProps {
  submission: FormSubmission | null;
  template?: FormTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormViewDialog({
  submission,
  template,
  open,
  onOpenChange,
}: FormViewDialogProps) {
  if (!submission) return null;

  const data = submission.data as Record<string, unknown> | null;
  const fields = (template?.fields as unknown as FormField[]) || [];

  const formatValue = (field: FormField, value: unknown): string => {
    if (value === null || value === undefined) return "-";
    
    switch (field.type) {
      case "checkbox":
        return value ? "Yes" : "No";
      case "date":
        try {
          return format(parseISO(value as string), "MMM d, yyyy");
        } catch {
          return String(value);
        }
      default:
        return String(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {submission.form_templates?.name || "Form Submission"}
          </DialogTitle>
          <DialogDescription>
            Submitted on{" "}
            {submission.submitted_at
              ? format(parseISO(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")
              : "Unknown date"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.length === 0 ? (
            <div className="space-y-2">
              {data && Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span className="font-medium">{key}</span>
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{field.label}</span>
                  {field.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {data ? formatValue(field, data[field.id]) : "-"}
                </p>
                <Separator className="mt-2" />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
