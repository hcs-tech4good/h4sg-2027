import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnnouncementCardProps {
  title: string;
  content: string;
  createdAt: string | null;
  children?: React.ReactNode;
}

// Fixed locale and timezone so the server render, the browser, and the admin
// preview all show the same date (the event runs on Eastern time).
export function formatAnnouncementDate(iso: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

// Turns http(s) URLs into links. Everything else stays plain text, so
// announcement content can never inject markup.
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) => {
        if (i % 2 === 0) return part;
        const trailing = part.match(/[.,!?;:)\]]+$/)?.[0] ?? "";
        const href = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <span key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 underline break-all"
            >
              {href}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}

export function AnnouncementCard({ title, content, createdAt, children }: AnnouncementCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <span className="min-w-0 break-words">{title}</span>
          <span className="shrink-0 text-sm font-normal text-gray-400">
            {formatAnnouncementDate(createdAt)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap break-words text-gray-600">
          <Linkified text={content} />
        </p>
        {children}
      </CardContent>
    </Card>
  );
}
