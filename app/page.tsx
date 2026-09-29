export default function Home() {
  return (
    // The className values are Tailwind CSS utility classes.
    <main className="flex min-h-screen items-center justify-center bg-green-50 p-8">
      <div className="max-w-xl text-center">
        {/* This is the main product heading. */}
        <h1 className="text-5xl font-bold text-green-900">
          PlantLens
        </h1>

        {/* For now this is just our MVP placeholder message. */}
        <p className="mt-4 text-lg text-green-700">
          Understand how your plants are doing, one photo at a time.
        </p>

        <p className="mt-8 text-sm text-green-600">
          Phase 1: application setup complete.
        </p>
      </div>
    </main>
  );
}