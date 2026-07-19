import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <p className="max-w-md text-sm text-zinc-500">
        The page you are looking for does not exist or was moved.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants())}>
        Go to dashboard
      </Link>
    </div>
  );
}
