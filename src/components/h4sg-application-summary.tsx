import { H4SG_FIELDS, isH4sgFieldVisible, type H4sgDetails } from "@/lib/h4sg-application";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function H4sgApplicationSummary({ details }: { details?: H4sgDetails | null }) {
  if (!details || !Object.keys(details).length) return null;
  return <Card>
    <CardHeader><CardTitle>H4SG Application Details</CardTitle></CardHeader>
    <CardContent className="divide-y">
      {H4SG_FIELDS.filter((field) => isH4sgFieldVisible(field, details)).map((field) => {
        const value = details[field.key];
        const display = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;
        return <div key={field.key} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-2">
          <span className="text-sm text-gray-500">{field.label}</span>
          <span className="whitespace-pre-wrap break-words text-sm sm:col-span-2">{display || "—"}</span>
        </div>;
      })}
    </CardContent>
  </Card>;
}
