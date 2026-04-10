import Link from "next/link";

const NAV_ITEMS = [
  {
    href: "/timetable",
    title: "Timetable",
    description: "Create and export weekly class timetables",
    icon: "🗓",
  },
  {
    href: "/poster",
    title: "Daily Poster",
    description: "Generate daily class posters for social media",
    icon: "📸",
  },
  {
    href: "/teachers",
    title: "Teachers",
    description: "Manage teacher profiles and photos",
    icon: "👥",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JSW" className="h-40 mx-auto mb-0" />
        <h1 className="text-4xl font-extrabold tracking-tight">
          JSW DANCE STUDIO
        </h1>
        <p className="text-violet-300 mt-2">Administration</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-zinc-900 hover:bg-zinc-800 rounded-2xl p-6 text-center transition-colors"
          >
            <div className="text-3xl mb-3">{item.icon}</div>
            <div className="font-bold text-lg">{item.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{item.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
