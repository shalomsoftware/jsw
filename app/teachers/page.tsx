"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Teacher = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image_url: string | null;
  created_at: string;
};

const EMPTY_FORM = { name: "", role: "", bio: "" };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setTeachers(data);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("teacher-images")
      .upload(fileName, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data } = supabase.storage
      .from("teacher-images")
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    let image_url: string | null = null;
    if (imageFile) {
      image_url = await uploadImage(imageFile);
    }

    if (editingId) {
      const updates: Record<string, string> = {
        name: form.name,
        role: form.role,
        bio: form.bio,
      };
      if (image_url) updates.image_url = image_url;
      await supabase.from("teachers").update(updates).eq("id", editingId);
    } else {
      await supabase.from("teachers").insert({
        name: form.name,
        role: form.role,
        bio: form.bio,
        image_url,
      });
    }

    setForm(EMPTY_FORM);
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
    await fetchTeachers();
    setLoading(false);
  };

  const handleEdit = (t: Teacher) => {
    setEditingId(t.id);
    setForm({ name: t.name, role: t.role, bio: t.bio });
    setImagePreview(t.image_url);
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    await supabase.from("teachers").delete().eq("id", id);
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
      setImagePreview(null);
    }
    await fetchTeachers();
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white p-3 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Teachers</h1>
          <Link
            href="/"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            &larr; Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6">
          {/* Form */}
          <div className="bg-zinc-900 rounded-2xl p-5 space-y-4 h-fit">
            <h2 className="text-lg font-bold">
              {editingId ? "Edit Teacher" : "Add Teacher"}
            </h2>
            <div className="space-y-3">
              <input
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                placeholder="Role (e.g. K-Pop Instructor)"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
              <textarea
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Bio (optional)"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Photo
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-white file:cursor-pointer"
                />
              </div>
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 rounded-lg py-2 font-semibold text-sm"
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Add Teacher"}
              </button>
              {editingId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(editingId)}
                    className="flex-1 bg-red-600 hover:bg-red-500 rounded-lg py-2 font-semibold text-sm"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg py-2 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Teacher list */}
          <div className="space-y-4">
            {teachers.length === 0 && (
              <p className="text-zinc-500 text-sm">
                No teachers yet. Add one to get started.
              </p>
            )}
            {teachers.map((t) => (
              <div
                key={t.id}
                onClick={() => handleEdit(t)}
                className={`flex gap-4 items-center bg-zinc-900 rounded-xl p-4 cursor-pointer ${
                  editingId === t.id
                    ? "ring-1 ring-fuchsia-400"
                    : "hover:bg-zinc-800"
                }`}
              >
                {t.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.image_url}
                    alt={t.name}
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-zinc-700 shrink-0 flex items-center justify-center text-xl font-bold text-zinc-400">
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{t.name}</div>
                  {t.role && (
                    <div className="text-sm text-violet-300">{t.role}</div>
                  )}
                  {t.bio && (
                    <div className="text-xs text-zinc-400 line-clamp-2 mt-1">
                      {t.bio}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="text-zinc-500 hover:text-white text-lg px-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
