import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, "PPP");
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function getServerCredentials() {
  return {
    companyName: process.env.COMPANY_NAME || "",
    clientID: process.env.CLIENT_ID || "",
    clientSecret: process.env.CLIENT_SECRET || "",
    ownerName: process.env.OWNER_NAME || "",
    ownerEmail: process.env.OWNER_EMAIL || "",
    rollNo: process.env.ROLL_NO || "",
  };
}
