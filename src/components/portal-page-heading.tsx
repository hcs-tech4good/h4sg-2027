import { OceanFriends } from "@/components/marine-art";

export function PortalPageHeading({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description?: string; children?: React.ReactNode;
}) {
  return <div className="portal-page-heading"><div><p className="portal-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="portal-page-description">{description}</p>}</div>{children ? <div className="portal-page-heading-action">{children}</div> : <OceanFriends />}</div>;
}
