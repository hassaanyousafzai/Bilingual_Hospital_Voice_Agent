"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  Plus,
  Star,
  Stethoscope,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { Department, Doctor, DoctorCreate, Language } from "@/types";
import { api } from "@/lib/api";
import { t, weekdayShort } from "@/lib/i18n";
import { cn, formatTime, relativeDay } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:bg-white";
const labelCls = "mb-1.5 block text-xs font-semibold text-ink-soft";

function DoctorTile({
  doctor,
  language,
  departments,
  onDelete,
  busy,
  index,
}: {
  doctor: Doctor;
  language: Language;
  departments: Department[];
  onDelete: (d: Doctor) => void;
  busy: boolean;
  index: number;
}) {
  const dept = departments.find((d) => d.id === doctor.department_id);
  const name = language === "ar" ? doctor.name_ar : doctor.name_en;
  const altName = language === "ar" ? doctor.name_en : doctor.name_ar;
  const branch = language === "ar" ? doctor.branch_ar : doctor.branch_en;
  const bio = language === "ar" ? doctor.bio_ar : doctor.bio_en;
  const deptName = language === "ar" ? doctor.department_name_ar : doctor.department_name_en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={doctor.name_en} size={54} accent={dept?.accent} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-ink">{name}</div>
          <div className="truncate text-xs text-ink-muted" dir={language === "ar" ? "ltr" : "rtl"}>
            {altName}
          </div>
          <div className="mt-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${dept?.accent ?? "#2563eb"}18`, color: dept?.accent ?? "#2563eb" }}
            >
              <Stethoscope className="h-3.5 w-3.5" /> {deptName}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(doctor)}
          disabled={busy}
          title={t("doc_remove", language)}
          className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-2.5 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {doctor.rating.toFixed(1)} {t("doc_rating", language)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" /> {doctor.experience_years} {t("doc_experience", language)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" /> {doctor.consultation_duration} {t("doc_min", language)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-teal-500" /> {doctor.available_dates.length} {t("doc_days_open", language)}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {branch}
      </div>
      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-muted">
        <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {doctor.languages.join(language === "ar" ? "، " : ", ")}
      </div>

      {bio ? <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-muted">{bio}</p> : null}

      {doctor.next_available ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Badge tone="teal">
            <CalendarClock className="h-3.5 w-3.5" />
            {t("doc_next", language)}: {relativeDay(doctor.next_available.date, language)} · {formatTime(doctor.next_available.time, language)}
          </Badge>
        </div>
      ) : null}
    </motion.div>
  );
}

function AddDoctorModal({
  open,
  departments,
  language,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  departments: Department[];
  language: Language;
  onClose: () => void;
  onSubmit: (data: DoctorCreate) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<DoctorCreate>({
    name_en: "",
    name_ar: "",
    department_key: "",
    branch_en: "Al Noor Medical City — Tower A",
    branch_ar: "",
    experience_years: 8,
    languages: ["English", "Arabic"],
    bio_en: "",
    bio_ar: "",
    consultation_duration: 30,
    rating: 4.7,
    work_days: [0, 1, 2, 3, 4, 5, 6],
  });
  const [langText, setLangText] = useState("English, Arabic");
  const [err, setErr] = useState<string | null>(null);

  const deptKey = form.department_key || departments[0]?.key || "";

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      work_days: f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d].sort(),
    }));

  const submit = () => {
    if (!form.name_en.trim() || !form.name_ar.trim()) {
      setErr(t("form_required", language));
      return;
    }
    setErr(null);
    onSubmit({
      ...form,
      department_key: deptKey,
      languages: langText.split(",").map((s) => s.trim()).filter(Boolean),
      work_days: form.work_days.length ? form.work_days : [0, 1, 2, 3, 4, 5, 6],
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-3xl bg-white shadow-card"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink">{t("form_title", language)}</h3>
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-ink-muted hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("form_name_en", language)} *</label>
                    <input className={inputCls} dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Dr. Sami Adel" />
                  </div>
                  <div>
                    <label className={labelCls}>{t("form_name_ar", language)} *</label>
                    <input className={inputCls} dir="rtl" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="د. سامي عادل" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("form_department", language)}</label>
                    <select className={inputCls} value={deptKey} onChange={(e) => setForm({ ...form, department_key: e.target.value })}>
                      {departments.map((d) => (
                        <option key={d.key} value={d.key}>
                          {language === "ar" ? d.name_ar : d.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("form_branch", language)}</label>
                    <input className={inputCls} value={form.branch_en} onChange={(e) => setForm({ ...form, branch_en: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>{t("form_experience", language)}</label>
                    <input type="number" min={0} className={inputCls} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: +e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("form_duration", language)}</label>
                    <input type="number" min={5} step={5} className={inputCls} value={form.consultation_duration} onChange={(e) => setForm({ ...form, consultation_duration: +e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("form_rating", language)}</label>
                    <input type="number" min={0} max={5} step={0.1} className={inputCls} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t("form_languages", language)}</label>
                  <input className={inputCls} value={langText} onChange={(e) => setLangText(e.target.value)} placeholder="English, Arabic, French" />
                </div>

                <div>
                  <label className={labelCls}>{t("form_bio", language)}</label>
                  <textarea
                    className={cn(inputCls, "h-20 resize-none py-2.5")}
                    value={form.bio_en}
                    onChange={(e) => setForm({ ...form, bio_en: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t("form_days", language)}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                          form.work_days.includes(d)
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-slate-200 bg-white text-ink-soft hover:border-slate-300"
                        )}
                      >
                        {weekdayShort(d, language)}
                      </button>
                    ))}
                  </div>
                </div>

                {err ? <p className="text-sm text-rose-600">{err}</p> : null}
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
                <Button variant="ghost" onClick={onClose}>{t("form_cancel", language)}</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? t("form_saving", language) : t("form_save", language)}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default function DoctorsPage() {
  const { language } = useUIStore();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const doctorsQ = useQuery({ queryKey: ["doctors"], queryFn: () => api.doctors() });
  const deptsQ = useQuery({ queryKey: ["departments"], queryFn: api.departments });

  const createMut = useMutation({
    mutationFn: (data: DoctorCreate) => api.createDoctor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      qc.invalidateQueries({ queryKey: ["demo-status"] });
      setModalOpen(false);
      setNotice({ kind: "ok", text: t("form_added", language) });
    },
    onError: () => setNotice({ kind: "err", text: t("form_required", language) }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteDoctor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      qc.invalidateQueries({ queryKey: ["demo-status"] });
    },
    onError: (e: Error) => {
      const text = e.message.includes("409") ? t("doc_has_appts", language) : e.message;
      setNotice({ kind: "err", text });
    },
  });

  const departments = deptsQ.data ?? [];
  const doctors = doctorsQ.data ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? doctors : doctors.filter((d) => d.department_key === filter)),
    [doctors, filter]
  );

  const onDelete = (d: Doctor) => {
    if (!window.confirm(`${t("doc_remove_confirm", language)}\n\n${d.name_en}`)) return;
    setNotice(null);
    deleteMut.mutate(d.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("doc_dir_title", language)}</h1>
          <p className="mt-2 text-ink-soft">{t("doc_dir_subtitle", language)}</p>
        </div>
        <Button onClick={() => { setNotice(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> {t("doc_add", language)}
        </Button>
      </div>

      {/* Department filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            filter === "all" ? "bg-ink text-white" : "bg-white text-ink-soft border border-slate-200 hover:border-slate-300"
          )}
        >
          {t("doc_all_depts", language)} · {doctors.length}
        </button>
        {departments.map((d) => {
          const count = doctors.filter((doc) => doc.department_key === d.key).length;
          const active = filter === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setFilter(d.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                active ? "border-transparent text-white" : "border-slate-200 bg-white text-ink-soft hover:border-slate-300"
              )}
              style={active ? { background: d.accent } : undefined}
            >
              {language === "ar" ? d.name_ar : d.name_en} · {count}
            </button>
          );
        })}
      </div>

      {notice ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
            notice.kind === "ok" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
          )}
        >
          {notice.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {notice.text}
        </div>
      ) : null}

      {/* Grid */}
      {doctorsQ.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-12 text-center text-ink-muted">
          {t("doc_empty", language)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d, i) => (
            <DoctorTile
              key={d.id}
              doctor={d}
              language={language}
              departments={departments}
              onDelete={onDelete}
              busy={deleteMut.isPending}
              index={i}
            />
          ))}
        </div>
      )}

      <AddDoctorModal
        open={modalOpen}
        departments={departments}
        language={language}
        saving={createMut.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={(data) => createMut.mutate(data)}
      />
    </div>
  );
}
