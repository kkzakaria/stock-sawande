import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-4 text-lg text-gray-600">Page not found</p>
      <Link
        href="/"
        className="mt-8 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Go home
      </Link>
    </div>
  )
}
