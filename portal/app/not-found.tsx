import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <p className="text-sm text-muted">The page you’re looking for doesn’t exist or was removed.</p>
      <ButtonLink href="/">Back to overview</ButtonLink>
    </div>
  );
}
