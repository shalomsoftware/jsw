"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";

const STORAGE_KEY = "jsw-timetable-classes-v1";
const LABELS_STORAGE_KEY = "jsw-timetable-labels-v1";

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type ClassBlock = {
  id: string;
  title: string;
  instructor: string;
  day: DayKey;
  start: number; // minutes from START_HOUR*60
  duration: number; // minutes
  color: string;
  openEnrolment: boolean;
};

type Tier = { price: string; label: string };

const START_HOUR = 9;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const PX_PER_MIN = 1.1; // grid pixel density on screen
const SNAP = 15;

const PALETTE = [
  "#ff5b8a",
  "#7a5cff",
  "#22b8cf",
  "#f59f00",
  "#37b24d",
  "#f06529",
  "#4263eb",
];

const PRICING: Tier[] = [
  { price: "$30", label: "TRIAL / HR" },
  { price: "$210", label: "8 CLASSES" },
  { price: "$260", label: "10 CLASSES" },
  { price: "$400", label: "16 CLASSES" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fmt(min: number) {
  const total = START_HOUR * 60 + min;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const DEFAULT_CLASSES: ClassBlock[] = [
  { id: "seed-1", title: "K-POP BEGINNER", instructor: "JIA", day: "MON", start: 60, duration: 60, color: PALETTE[0], openEnrolment: true },
  { id: "seed-2", title: "HIP-HOP FOUNDATIONS", instructor: "REX", day: "WED", start: 240, duration: 90, color: PALETTE[2], openEnrolment: false },
  { id: "seed-3", title: "JAZZ FUNK", instructor: "MAYA", day: "FRI", start: 420, duration: 60, color: PALETTE[3], openEnrolment: true },
  { id: "seed-4", title: "K-POP ADVANCED", instructor: "JIA", day: "SAT", start: 180, duration: 75, color: PALETTE[1], openEnrolment: false },
];

const EMPTY_FORM = {
  title: "",
  instructor: "",
  day: "MON" as DayKey,
  startHour: 18,
  startMin: 0,
  duration: 60,
  color: PALETTE[0],
  openEnrolment: false,
};

const DEFAULT_LABELS: Record<string, string> = {
  [PALETTE[0]]: "K-POP",
  [PALETTE[1]]: "K-POP ADV",
  [PALETTE[2]]: "HIP-HOP",
  [PALETTE[3]]: "JAZZ",
  [PALETTE[4]]: "",
  [PALETTE[5]]: "",
  [PALETTE[6]]: "",
};

export default function Home() {
  const [classes, setClasses] = useState<ClassBlock[]>(DEFAULT_CLASSES);
  const [colorLabels, setColorLabels] = useState<Record<string, string>>(DEFAULT_LABELS);
  const [hydrated, setHydrated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setClasses(parsed);
      }
      const labelsRaw = localStorage.getItem(LABELS_STORAGE_KEY);
      if (labelsRaw) {
        const parsed = JSON.parse(labelsRaw);
        if (parsed && typeof parsed === "object") setColorLabels(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist to localStorage after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
      localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(colorLabels));
    } catch {}
  }, [classes, colorLabels, hydrated]);

  const gridRef = useRef<HTMLDivElement | null>(null);

  const saveClass = () => {
    if (!form.title.trim()) return;
    const start = (form.startHour - START_HOUR) * 60 + form.startMin;
    if (start < 0 || start + form.duration > TOTAL_MINUTES) return;
    const data = {
      title: form.title.toUpperCase(),
      instructor: form.instructor.toUpperCase(),
      day: form.day,
      start,
      duration: form.duration,
      color: form.color,
      openEnrolment: form.openEnrolment,
    };
    if (editingId) {
      setClasses((cs) => cs.map((c) => (c.id === editingId ? { ...c, ...data } : c)));
      setEditingId(null);
    } else {
      setClasses((cs) => [...cs, { id: uid(), ...data }]);
    }
    setForm(EMPTY_FORM);
  };

  const removeClass = (id: string) => {
    setClasses((c) => c.filter((x) => x.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  };

  const selectForEdit = useCallback((id: string) => {
    setClasses((cs) => {
      const c = cs.find((x) => x.id === id);
      if (c) {
        setEditingId(id);
        setForm({
          title: c.title,
          instructor: c.instructor,
          day: c.day,
          startHour: START_HOUR + Math.floor(c.start / 60),
          startMin: c.start % 60,
          duration: c.duration,
          color: c.color,
          openEnrolment: c.openEnrolment,
        });
      }
      return cs;
    });
  }, []);

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const block = classes.find((c) => c.id === id);
      if (!block) return;
      const initial = block.start;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      let dragged = false;

      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        if (!dragged && Math.abs(dy) < 4) return;
        dragged = true;
        const dMin = Math.round(dy / PX_PER_MIN / SNAP) * SNAP;
        let next = initial + dMin;
        next = Math.max(0, Math.min(TOTAL_MINUTES - block.duration, next));
        setClasses((cs) => cs.map((c) => (c.id === id ? { ...c, start: next } : c)));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!dragged) selectForEdit(id);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [classes, selectForEdit],
  );

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) arr.push(h);
    return arr;
  }, []);

  // Legend = unique colors, label from first class using that color
  // Legend: only colours that have a non-empty label
  const legend = useMemo(
    () =>
      PALETTE.filter((c) => colorLabels[c]?.trim()).map((c) => ({
        color: c,
        label: colorLabels[c].trim(),
      })),
    [colorLabels],
  );

  const exportPNG = useCallback(async () => {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b0b14");
    grad.addColorStop(1, "#1a1230");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ---------- HEADER ----------
    const padX = 20;
    const headerTop = 14;
    const headerH = 110;

    // logo (left)
    let logoRight = padX;
    try {
      const logo = await loadImage("/logo.png");
      const logoH = 100;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.drawImage(logo, padX, headerTop + (headerH - logoH) / 2, logoW, logoH);
      logoRight = padX + logoW + 14;
    } catch {
      // continue without logo
    }

    // title + subtitle (left, next to logo)
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 38px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillText("JSW DANCE STUDIO", logoRight, headerTop + 56);
    ctx.font = "500 17px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillStyle = "#c9b8ff";
    ctx.fillText("AUCKLAND  ·  K-POP  ·  HIP-HOP  ·  JAZZ", logoRight, headerTop + 82);

    // right block: 2026 TIMETABLE + social
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 26px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillText("2026 TIMETABLE", W - padX, headerTop + 56);
    ctx.font = "500 16px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillStyle = "#c9b8ff";
    ctx.fillText("@jswdancestudio", W - padX, headerTop + 80);

    // ---------- GRID ----------
    const gridTop = headerTop + headerH + 4;
    const gridBottom = 1218;
    const gridH = gridBottom - gridTop;
    const labelW = 48;
    const colsX = padX + labelW;
    const colsW = W - padX - colsX;
    const colW = colsW / 7;
    const dayHeaderH = 38;
    const bodyTop = gridTop + dayHeaderH;
    const bodyH = gridH - dayHeaderH;
    const pxPerMin = bodyH / TOTAL_MINUTES;

    // grid panel background
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(colsX, gridTop, colsW, gridH);

    // day headers
    ctx.font = "700 20px system-ui, -apple-system, Helvetica, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    DAYS.forEach((d, i) => {
      ctx.fillText(d, colsX + colW * (i + 0.5), gridTop + 26);
    });
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colsX, bodyTop);
    ctx.lineTo(colsX + colsW, bodyTop);
    ctx.stroke();

    // hour rows + labels
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 15px system-ui, -apple-system, Helvetica, Arial";
    ctx.textAlign = "right";
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const y = bodyTop + (h - START_HOUR) * 60 * pxPerMin;
      ctx.beginPath();
      ctx.moveTo(colsX, y);
      ctx.lineTo(colsX + colsW, y);
      ctx.stroke();
      const hh = ((h + 11) % 12) + 1;
      const ampm = h >= 12 ? "PM" : "AM";
      ctx.fillText(`${hh}${ampm}`, colsX - 8, y + 5);
    }

    // column dividers
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i <= 7; i++) {
      const x = colsX + colW * i;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridBottom);
      ctx.stroke();
    }

    // class blocks — maximised width, tight gutters
    const gutter = 3;
    classes.forEach((c) => {
      const dayIdx = DAYS.indexOf(c.day);
      const x = colsX + dayIdx * colW + gutter;
      const y = bodyTop + c.start * pxPerMin + 2;
      const w = colW - gutter * 2;
      const h = c.duration * pxPerMin - 4;

      roundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = c.color;
      ctx.fill();

      const padL = 10;
      const textX = x + padL;
      const textMaxW = w - padL;

      // title (wrapped)
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.font = "800 18px system-ui, -apple-system, Helvetica, Arial";
      const titleLines = wrapText(ctx, c.title, textMaxW);
      let ty = y + 22;
      for (const line of titleLines) {
        if (ty > y + h - 4) break;
        ctx.fillText(line, textX, ty);
        ty += 20;
      }

      // time
      ctx.font = "500 14px system-ui, -apple-system, Helvetica, Arial";
      const meta = fmt(c.start);
      if (ty + 16 <= y + h - 2) {
        ctx.fillText(wrapText(ctx, meta, textMaxW)[0] ?? "", textX, ty);
        ty += 18;
      }
      if (c.instructor && ty + 16 <= y + h - 2) {
        ctx.fillText(wrapText(ctx, c.instructor, textMaxW)[0] ?? "", textX, ty);
      }

      // open enrolment dot (top-right)
      if (c.openEnrolment) {
        ctx.fillStyle = "#ff7a00";
        ctx.beginPath();
        ctx.arc(x + w - 10, y + 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

    });

    // ---------- LEGEND ROW ----------
    const legendY = gridBottom + 28;
    ctx.textAlign = "left";
    ctx.font = "600 14px system-ui, -apple-system, Helvetica, Arial";
    let lx = padX;
    for (const item of legend) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(lx + 7, legendY - 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      const label = item.label;
      ctx.fillText(label, lx + 20, legendY);
      lx += 22 + ctx.measureText(label).width + 18;
    }

    // Open for enrolment note — right side of legend row
    const note = "Open for enrolment — DM to book";
    ctx.font = "600 14px system-ui, -apple-system, Helvetica, Arial";
    const noteW = ctx.measureText(note).width;
    const noteX = W - padX - noteW;
    ctx.fillStyle = "#ff7a00";
    ctx.beginPath();
    ctx.arc(noteX - 14, legendY - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(note, noteX, legendY);

    // ---------- PRICING TIER ----------
    const pricingTop = legendY + 16;
    const pricingH = 72;
    const tierGap = 10;
    const tierW = (W - padX * 2 - tierGap * (PRICING.length - 1)) / PRICING.length;
    PRICING.forEach((t, i) => {
      const tx = padX + i * (tierW + tierGap);
      roundedRect(ctx, tx, pricingTop, tierW, pricingH, 14);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 28px system-ui, -apple-system, Helvetica, Arial";
      ctx.fillText(t.price, tx + tierW / 2, pricingTop + 36);
      ctx.font = "600 13px system-ui, -apple-system, Helvetica, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(t.label, tx + tierW / 2, pricingTop + 58);
    });

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "jsw-timetable.png";
    a.click();
  }, [classes, legend]);

  const gridHeight = TOTAL_MINUTES * PX_PER_MIN;

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white p-6">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="bg-zinc-900 rounded-2xl p-5 space-y-4 h-fit">
          <h2 className="text-lg font-bold">
            {editingId ? "Edit Class" : "Add Class"}
          </h2>
          <div className="space-y-3">
            <input
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
              placeholder="Class title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
              placeholder="Instructor"
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            />
            <select
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value as DayKey })}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                value={form.startHour}
                onChange={(e) => setForm({ ...form, startHour: +e.target.value })}
              >
                {hours.slice(0, -1).map((h) => (
                  <option key={h} value={h}>
                    {((h + 11) % 12) + 1}
                    {h >= 12 ? "PM" : "AM"}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                value={form.startMin}
                onChange={(e) => setForm({ ...form, startMin: +e.target.value })}
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    :{m.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            <select
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: +e.target.value })}
            >
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <div className="flex gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 ${
                    form.color === c ? "border-white" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.openEnrolment}
                onChange={(e) => setForm({ ...form, openEnrolment: e.target.checked })}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />
              Open for enrolment
            </label>
            <button
              onClick={saveClass}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg py-2 font-semibold text-sm"
            >
              {editingId ? "Save Changes" : "Add Class"}
            </button>
            {editingId && (
              <div className="flex gap-2">
                <button
                  onClick={() => removeClass(editingId)}
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

          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <h3 className="text-xs uppercase text-zinc-400">Colour Legend</h3>
            {PALETTE.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: c }}
                />
                <input
                  className="flex-1 bg-zinc-800 rounded-lg px-2 py-1 text-xs"
                  placeholder="Label (leave blank to hide)"
                  value={colorLabels[c] ?? ""}
                  onChange={(e) =>
                    setColorLabels((prev) => ({ ...prev, [c]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={exportPNG}
              className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-lg py-3 font-bold"
            >
              Export PNG (1080×1350)
            </button>
          </div>

          {classes.length > 0 && (
            <div className="pt-3 border-t border-zinc-800 space-y-2 max-h-64 overflow-auto">
              <h3 className="text-xs uppercase text-zinc-400">Classes</h3>
              {classes.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 cursor-pointer ${
                    editingId === c.id
                      ? "bg-fuchsia-900/60 ring-1 ring-fuchsia-400"
                      : "bg-zinc-800 hover:bg-zinc-700"
                  }`}
                  onClick={() => selectForEdit(c.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: c.color }} />
                    {c.openEnrolment && (
                      <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    )}
                    <span className="truncate">
                      {c.day} {c.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeClass(c.id);
                    }}
                    className="text-zinc-500 hover:text-white px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Preview */}
        <main className="bg-gradient-to-b from-[#0b0b14] to-[#1a1230] rounded-2xl p-6 overflow-hidden">
          {/* header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="JSW logo" className="h-14 w-auto" />
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight leading-none">
                  JSW DANCE STUDIO
                </h1>
                <p className="text-xs text-violet-300 mt-1">
                  AUCKLAND · K-POP · HIP-HOP · JAZZ
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold leading-none">2026 TIMETABLE</div>
              <div className="text-xs text-violet-300 mt-1">@jswdancestudio</div>
            </div>
          </div>

          <div ref={gridRef} className="mt-5">
            {/* day headers */}
            <div className="grid grid-cols-[50px_repeat(7,1fr)] text-center text-xs font-bold border-b border-white/20 pb-2">
              <div />
              {DAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            {/* body */}
            <div
              className="grid grid-cols-[50px_repeat(7,1fr)] relative"
              style={{ height: gridHeight }}
            >
              <div className="relative">
                {hours.map((h) => {
                  const top = (h - START_HOUR) * 60 * PX_PER_MIN;
                  const hh = ((h + 11) % 12) + 1;
                  return (
                    <div
                      key={h}
                      className="absolute right-2 text-[10px] text-white/50"
                      style={{ top: top - 6 }}
                    >
                      {hh}
                      {h >= 12 ? "PM" : "AM"}
                    </div>
                  );
                })}
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="relative border-l border-white/10"
                  style={{ height: gridHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
                    />
                  ))}
                  {classes
                    .filter((c) => c.day === day)
                    .map((c) => (
                      <div
                        key={c.id}
                        onPointerDown={(e) => onPointerDown(e, c.id)}
                        className={`absolute rounded-lg p-2 text-[10px] text-white cursor-grab active:cursor-grabbing select-none touch-none ${
                          editingId === c.id ? "ring-2 ring-white ring-inset" : ""
                        }`}
                        style={{
                          top: c.start * PX_PER_MIN,
                          height: c.duration * PX_PER_MIN,
                          left: 2,
                          right: 2,
                          backgroundColor: c.color,
                        }}
                      >
                        {c.openEnrolment && (
                          <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-orange-500 ring-1 ring-white/90" />
                        )}
                        <div className="font-extrabold leading-tight break-words pr-3">
                          {c.title}
                        </div>
                        <div className="opacity-90">{fmt(c.start)}</div>
                        {c.instructor && <div className="opacity-90">{c.instructor}</div>}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend + open enrolment note */}
          <div className="mt-5 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              {legend.map((l) => (
                <div key={l.color} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-white/80">{l.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500 ring-1 ring-white/80" />
              <span className="text-white/80">Open for enrolment — DM to book</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRICING.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-white/10 bg-white/5 py-4 text-center"
              >
                <div className="text-2xl font-extrabold">{t.price}</div>
                <div className="text-[10px] text-white/50 mt-1">{t.label}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
