export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <h1 className="text-4xl font-bold">Home</h1>
      <p>This is the home page. It is pre-rendered.</p>
    </div>
  )
}

export function meta() {
  return [
    {
      title: 'Home',
    },
    {
      property: 'og:title',
      content: 'Home',
    },
    {
      name: 'description',
      content: 'Home page',
    },
  ]
}
