export default async function Soon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="card">
      <h1 className="text-lg font-semibold capitalize">{slug}</h1>
      <p className="mt-1 text-sm text-zinc-500">This section is built in a later step.</p>
    </div>
  );
}
