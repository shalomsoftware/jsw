"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Teacher = { id: string; name: string; image_url: string | null };

type PosterClass = {
  id: string;
  time: string;
  classType: string;
  song: string;
  teacherId: string;
  teacherName: string;
  teacherImage: string | null;
};

const DAYS_FULL = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function formatDate(d: Date): string {
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "ST"
      : day % 10 === 2 && day !== 12
        ? "ND"
        : day % 10 === 3 && day !== 13
          ? "RD"
          : "TH";
  const month = d.toLocaleString("en-US", { month: "long" }).toUpperCase();
  return `${day}${suffix} ${month}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const POSTER_STORAGE_KEY = "jsw-poster-classes-v1";
const POSTER_DAY_KEY = "jsw-poster-day-v1";
const POSTER_DATE_KEY = "jsw-poster-date-v1";

export default function PosterPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<PosterClass[]>([]);
  const [day, setDay] = useState(
    DAYS_FULL[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
  );
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [hydrated, setHydrated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    time: "",
    classType: "",
    song: "",
    teacherId: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load from localStorage + fetch teachers
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setClasses(parsed);
      }
      const savedDay = localStorage.getItem(POSTER_DAY_KEY);
      if (savedDay) setDay(savedDay);
      const savedDate = localStorage.getItem(POSTER_DATE_KEY);
      if (savedDate) setDate(savedDate);
    } catch {}
    setHydrated(true);

    supabase
      .from("teachers")
      .select("id, name, image_url")
      .order("name")
      .then(({ data }) => {
        if (data) setTeachers(data);
      });
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(POSTER_STORAGE_KEY, JSON.stringify(classes));
      localStorage.setItem(POSTER_DAY_KEY, day);
      localStorage.setItem(POSTER_DATE_KEY, date);
    } catch {}
  }, [classes, day, date, hydrated]);

  const moveClass = (id: string, dir: -1 | 1) => {
    setClasses((cs) => {
      const idx = cs.findIndex((c) => c.id === id);
      if (idx < 0) return cs;
      const target = idx + dir;
      if (target < 0 || target >= cs.length) return cs;
      const next = [...cs];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const getTeacher = (id: string) => teachers.find((t) => t.id === id);

  const addClass = () => {
    if (!form.time.trim() || !form.classType.trim()) return;
    const teacher = getTeacher(form.teacherId);
    if (editingId) {
      setClasses((cs) =>
        cs.map((c) =>
          c.id === editingId
            ? {
                ...c,
                time: form.time,
                classType: form.classType.toUpperCase(),
                song: form.song.toUpperCase(),
                teacherId: form.teacherId,
                teacherName: teacher?.name.toUpperCase() ?? "",
                teacherImage: teacher?.image_url ?? null,
              }
            : c,
        ),
      );
      setEditingId(null);
    } else {
      setClasses((cs) => [
        ...cs,
        {
          id: uid(),
          time: form.time,
          classType: form.classType.toUpperCase(),
          song: form.song.toUpperCase(),
          teacherId: form.teacherId,
          teacherName: teacher?.name.toUpperCase() ?? "",
          teacherImage: teacher?.image_url ?? null,
        },
      ]);
    }
    setForm({ time: "", classType: "", song: "", teacherId: "" });
  };

  const editClass = (c: PosterClass) => {
    setEditingId(c.id);
    setForm({
      time: c.time,
      classType: c.classType,
      song: c.song,
      teacherId: c.teacherId,
    });
  };

  const deleteClass = (id: string) => {
    setClasses((cs) => cs.filter((c) => c.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm({ time: "", classType: "", song: "", teacherId: "" });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ time: "", classType: "", song: "", teacherId: "" });
  };

  const exportPNG = useCallback(async () => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#141414");
    grad.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const padX = 50;
    let curY = 40;

    // logo (larger)
    try {
      const logo = await loadImage("/logo.png");
      const logoH = 220;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.drawImage(logo, (W - logoW) / 2, curY, logoW, logoH);
      curY += logoH + 2;
    } catch {
      curY += 100;
    }

    // DANCE STUDIO text (larger, tight to logo) with decorative lines
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "400 28px system-ui, -apple-system, Helvetica, Arial";
    ctx.letterSpacing = "10px";
    ctx.fillText("DANCE STUDIO", W / 2, curY + 24);
    ctx.letterSpacing = "0px";
    const stW = ctx.measureText("DANCE STUDIO").width;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - stW / 2 - 60, curY + 19);
    ctx.lineTo(W / 2 - stW / 2 - 10, curY + 19);
    ctx.moveTo(W / 2 + stW / 2 + 10, curY + 19);
    ctx.lineTo(W / 2 + stW / 2 + 60, curY + 19);
    ctx.stroke();
    curY += 58;

    // DAY TIMETABLE
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillText(`${day} TIMETABLE`, W / 2, curY + 50);
    curY += 70;

    // Date with decorative lines
    const dateStr = formatDate(new Date(date + "T00:00:00"));
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "400 24px system-ui, -apple-system, Helvetica, Arial";
    ctx.letterSpacing = "4px";
    ctx.fillText(dateStr, W / 2, curY + 24);
    ctx.letterSpacing = "0px";
    const dtW = ctx.measureText(dateStr).width;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(W / 2 - dtW / 2 - 60, curY + 19);
    ctx.lineTo(W / 2 - dtW / 2 - 10, curY + 19);
    ctx.moveTo(W / 2 + dtW / 2 + 10, curY + 19);
    ctx.lineTo(W / 2 + dtW / 2 + 60, curY + 19);
    ctx.stroke();
    curY += 62;

    // Gradient divider (with y-padding)
    const divGrad = ctx.createLinearGradient(padX, 0, W - padX, 0);
    divGrad.addColorStop(0, "rgba(100,200,255,0)");
    divGrad.addColorStop(0.3, "rgba(100,200,255,0.5)");
    divGrad.addColorStop(0.7, "rgba(100,200,255,0.5)");
    divGrad.addColorStop(1, "rgba(100,200,255,0)");
    ctx.fillStyle = divGrad;
    ctx.fillRect(padX, curY, W - padX * 2, 2);
    curY += 28;

    // Class items
    const imgSize = 130;
    const classH = 170;
    for (const c of classes) {
      // card bg
      roundedRect(ctx, padX, curY, W - padX * 2, classH, 16);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();

      // time (left column)
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 30px system-ui, -apple-system, Helvetica, Arial";
      ctx.fillText(c.time, padX + 100, curY + classH / 2 + 10);

      // vertical separator
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX + 195, curY + 20);
      ctx.lineTo(padX + 195, curY + classH - 20);
      ctx.stroke();

      // class details
      const textX = padX + 220;
      ctx.textAlign = "left";

      // class type
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 34px system-ui, -apple-system, Helvetica, Arial";
      ctx.fillText(c.classType, textX, curY + 52);

      // song
      if (c.song) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "400 22px system-ui, -apple-system, Helvetica, Arial";
        ctx.fillText(c.song, textX, curY + 86);
      }

      // teacher
      if (c.teacherName) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "400 22px system-ui, -apple-system, Helvetica, Arial";
        ctx.fillText("with ", textX, curY + 122);
        const withW = ctx.measureText("with ").width;
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 22px system-ui, -apple-system, Helvetica, Arial";
        ctx.fillText(c.teacherName, textX + withW, curY + 122);
      }

      // line under teacher
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.moveTo(textX, curY + 138);
      ctx.lineTo(W - padX - imgSize - 30, curY + 138);
      ctx.stroke();

      // teacher image (right side)
      if (c.teacherImage) {
        try {
          const img = await loadImage(c.teacherImage);
          const imgX = W - padX - imgSize - 10;
          const imgY = curY + (classH - imgSize) / 2;
          // frame
          roundedRect(ctx, imgX - 3, imgY - 3, imgSize + 6, imgSize + 6, 14);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 2;
          ctx.stroke();
          // clip image
          ctx.save();
          roundedRect(ctx, imgX, imgY, imgSize, imgSize, 12);
          ctx.clip();
          ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
          ctx.restore();
        } catch {
          // skip if image fails to load
        }
      }

      curY += classH + 12;
    }

    // Bottom divider (with y-padding)
    curY += 24;
    ctx.fillStyle = divGrad;
    ctx.fillRect(padX, curY, W - padX * 2, 2);
    curY += 44;

    // Location & phone (larger, more visible)
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 30px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillText("📍  6 ARRENWAY DRIVE", W / 2, curY);
    curY += 46;
    ctx.fillText("📞  021 0824 2342", W / 2, curY);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `jsw-${day.toLowerCase()}-poster.png`;
    a.click();
  }, [classes, day, date]);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white p-3 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            &larr; Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="bg-zinc-900 rounded-2xl p-5 space-y-4 h-fit">
            <h2 className="text-lg font-bold">Poster Settings</h2>

            {/* Day + Date */}
            <div className="space-y-3">
              <select
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                {DAYS_FULL.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Add class form */}
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold">
                {editingId ? "Edit Class" : "Add Class"}
              </h3>
              <input
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                placeholder="Time (e.g. 4-5pm)"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <input
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                placeholder="Class type (e.g. K-POP)"
                value={form.classType}
                onChange={(e) =>
                  setForm({ ...form, classType: e.target.value })
                }
              />
              <input
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                placeholder="Song name (e.g. GOLDEN - KDH)"
                value={form.song}
                onChange={(e) => setForm({ ...form, song: e.target.value })}
              />
              <select
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                value={form.teacherId}
                onChange={(e) =>
                  setForm({ ...form, teacherId: e.target.value })
                }
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addClass}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg py-2 font-semibold text-sm"
              >
                {editingId ? "Save Changes" : "Add Class"}
              </button>
              {editingId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteClass(editingId)}
                    className="flex-1 bg-red-600 hover:bg-red-500 rounded-lg py-2 font-semibold text-sm"
                  >
                    Delete
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg py-2 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="pt-3 border-t border-zinc-800">
              <button
                onClick={exportPNG}
                className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-lg py-3 font-bold"
              >
                Export PNG (1080×1920)
              </button>
            </div>

            {/* Class list */}
            {classes.length > 0 && (
              <div className="pt-3 border-t border-zinc-800 space-y-2 max-h-64 overflow-auto">
                <h3 className="text-xs uppercase text-zinc-400">Classes</h3>
                {classes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => editClass(c)}
                    className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 cursor-pointer ${
                      editingId === c.id
                        ? "bg-fuchsia-900/60 ring-1 ring-fuchsia-400"
                        : "bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="truncate">
                      {c.time} — {c.classType}
                      {c.teacherName ? ` (${c.teacherName})` : ""}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClass(c.id);
                      }}
                      className="text-zinc-500 hover:text-white px-1"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Preview */}
          <main className="bg-gradient-to-b from-[#141414] to-[#0a0a0a] rounded-2xl p-6 overflow-hidden">
            {/* Logo + studio */}
            <div className="text-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="JSW"
                className="h-24 mx-auto mb-1"
              />
              <p className="text-xs tracking-[0.3em] text-white/50">
                DANCE STUDIO
              </p>
            </div>

            {/* Day + Date */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-extrabold">
                {day} TIMETABLE
              </h1>
              <p className="text-xs text-white/50 tracking-widest mt-1">
                {formatDate(new Date(date + "T00:00:00"))}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent mb-4" />

            {/* Classes */}
            <div className="space-y-3">
              {classes.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-8">
                  Add classes to build the poster
                </p>
              )}
              {classes.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => editClass(c)}
                  className={`flex items-center gap-4 bg-white/[0.03] rounded-xl p-4 cursor-pointer ${
                    editingId === c.id ? "ring-1 ring-fuchsia-400" : ""
                  }`}
                >
                  {/* Reorder */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveClass(c.id, -1); }}
                      disabled={i === 0}
                      className="text-white/40 hover:text-white disabled:opacity-20 text-xs leading-none"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveClass(c.id, 1); }}
                      disabled={i === classes.length - 1}
                      className="text-white/40 hover:text-white disabled:opacity-20 text-xs leading-none"
                    >
                      ▼
                    </button>
                  </div>
                  {/* Time */}
                  <div className="w-20 shrink-0 text-center font-bold text-lg">
                    {c.time}
                  </div>
                  {/* Separator */}
                  <div className="w-px self-stretch bg-white/10" />
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-lg">{c.classType}</div>
                    {c.song && (
                      <div className="text-sm text-white/60">{c.song}</div>
                    )}
                    {c.teacherName && (
                      <div className="text-sm text-white/60">
                        with{" "}
                        <span className="text-white font-bold">
                          {c.teacherName}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Teacher image */}
                  {c.teacherImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.teacherImage}
                      alt={c.teacherName}
                      className="w-16 h-16 rounded-lg object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-white/10" />
                  )}
                </div>
              ))}
            </div>

            {/* Bottom divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent mt-6 mb-4" />

            {/* Footer */}
            <div className="text-center text-sm text-white/60 space-y-1">
              <p>📍 6 ARRENWAY DRIVE</p>
              <p>📞 021 0824 2342</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
