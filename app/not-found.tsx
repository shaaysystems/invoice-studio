// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 text-center">
      <p className="font-mono text-xs tracking-widest text-shell-400">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-shell-900">We couldn&rsquo;t find that page</h1>
      <p className="mt-2 text-sm text-shell-500">
        The link may be out of date, or the invoice may have been deleted.
      </p>
      <div className="mt-6 flex justify-center gap-3 text-sm">
        <Link href="/dashboard" className="font-medium text-shell-900 underline">
          Go to your dashboard
        </Link>
        <Link href="/" className="text-shell-500 underline">
          Home
        </Link>
      </div>
    </main>
  );
}
