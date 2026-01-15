import { redirect } from "next/navigation";

/**
 * Time Clock page has been moved to Dashboard.
 * This page redirects to the dashboard where the Time Clock widget is now located.
 */
export default function TimeClockPage() {
  redirect("/dashboard");
}
