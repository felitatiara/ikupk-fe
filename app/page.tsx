import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="w-full max-w-2xl px-8 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            API Integration Test
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Frontend connected to NestJS Backend with PostgreSQL
          </p>

          <div className="space-y-4 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Frontend:</h3>
              <p className="text-blue-800">Next.js 16 running on http://localhost:3000</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h3 className="font-semibold text-green-900 mb-2">Backend:</h3>
              <p className="text-green-800">NestJS running on http://localhost:4000</p>
              <p className="text-green-700 text-sm mt-1">
                Connected to PostgreSQL (Database: iku_pk, Table: userr)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/login"
              className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Login
            </Link>

            <a
              href="http://localhost:4000/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Backend Home
            </a>
          </div>

          <div className="mt-8 space-y-4 text-sm">
            <h3 className="font-semibold text-gray-900">Quick Start:</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Ensure PostgreSQL is running with database "iku_pk"</li>
              <li>Run backend command in terminal 1: <code className="bg-gray-100 px-2 py-1 rounded">npm run start:dev</code></li>
              <li>Run frontend command in terminal 2: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code></li>
              <li>Click "View Users from API" button above to fetch data</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
