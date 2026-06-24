"use client";

import type { ParsedResume } from "@/lib/types";
import { Input, Textarea } from "@/components/ui";

function setField<K extends keyof ParsedResume>(
  data: ParsedResume,
  onChange: (d: ParsedResume) => void,
  key: K,
  value: ParsedResume[K]
) {
  onChange({ ...data, [key]: value });
}

function Basics({ data, onChange }: { data: ParsedResume; onChange: (d: ParsedResume) => void }) {
  return (
    <div className="mt-4 space-y-3">
      <Input label="Full name" value={data.full_name} onChange={(e) => setField(data, onChange, "full_name", e.target.value)} />
      <Input label="Email" value={data.email} onChange={(e) => setField(data, onChange, "email", e.target.value)} />
      <Input label="Phone" value={data.phone} onChange={(e) => setField(data, onChange, "phone", e.target.value)} />
      <Input label="Location" value={data.location} onChange={(e) => setField(data, onChange, "location", e.target.value)} />
    </div>
  );
}

function Work({ data, onChange }: { data: ParsedResume; onChange: (d: ParsedResume) => void }) {
  const items = data.work_experience;

  function update(i: number, patch: Partial<(typeof items)[0]>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    setField(data, onChange, "work_experience", next);
  }

  function add() {
    setField(data, onChange, "work_experience", [
      ...items,
      { company: "", title: "", start_date: "", end_date: "", currently_working: false, bullets: [""] },
    ]);
  }

  function remove(i: number) {
    setField(data, onChange, "work_experience", items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-4 space-y-4">
      {items.map((w, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <Input label="Company" value={w.company} onChange={(e) => update(i, { company: e.target.value })} />
          <div className="mt-2">
            <Input label="Title" value={w.title} onChange={(e) => update(i, { title: e.target.value })} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input label="Start" value={w.start_date} onChange={(e) => update(i, { start_date: e.target.value })} />
            <Input label="End" value={w.end_date} onChange={(e) => update(i, { end_date: e.target.value })} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={w.currently_working}
              onChange={(e) => update(i, { currently_working: e.target.checked })}
            />
            Currently working here
          </label>
          <Textarea
            label="Bullets (one per line)"
            rows={4}
            className="mt-2"
            value={w.bullets.join("\n")}
            onChange={(e) => update(i, { bullets: e.target.value.split("\n") })}
          />
          <button type="button" onClick={() => remove(i)} className="mt-2 text-sm text-red-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm font-semibold text-[#7c3aed]">
        + Add experience
      </button>
    </div>
  );
}

function Skills({ data, onChange }: { data: ParsedResume; onChange: (d: ParsedResume) => void }) {
  return (
    <div className="mt-4">
      <Textarea
        label="Skills (one per line)"
        rows={8}
        value={data.skills.join("\n")}
        onChange={(e) => setField(data, onChange, "skills", e.target.value.split("\n").filter(Boolean))}
      />
    </div>
  );
}

function Projects({ data, onChange }: { data: ParsedResume; onChange: (d: ParsedResume) => void }) {
  const items = data.projects;

  function update(i: number, patch: Partial<(typeof items)[0]>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    setField(data, onChange, "projects", next);
  }

  function add() {
    setField(data, onChange, "projects", [...items, { name: "", description: "", bullets: [""] }]);
  }

  function remove(i: number) {
    setField(data, onChange, "projects", items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-4 space-y-4">
      {items.map((p, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <Input label="Name" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
          <div className="mt-2">
            <Textarea
              label="Description"
              rows={2}
              value={p.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
          <Textarea
            label="Bullets (one per line)"
            rows={3}
            className="mt-2"
            value={p.bullets.join("\n")}
            onChange={(e) => update(i, { bullets: e.target.value.split("\n") })}
          />
          <button type="button" onClick={() => remove(i)} className="mt-2 text-sm text-red-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm font-semibold text-[#7c3aed]">
        + Add project
      </button>
    </div>
  );
}

function Education({ data, onChange }: { data: ParsedResume; onChange: (d: ParsedResume) => void }) {
  const items = data.education;

  function update(i: number, patch: Partial<(typeof items)[0]>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    setField(data, onChange, "education", next);
  }

  function add() {
    setField(data, onChange, "education", [
      ...items,
      { school: "", degree: "", field: "", graduation_date: "" },
    ]);
  }

  function remove(i: number) {
    setField(data, onChange, "education", items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-4 space-y-4">
      {items.map((e, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <Input label="School" value={e.school} onChange={(ev) => update(i, { school: ev.target.value })} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input label="Degree" value={e.degree} onChange={(ev) => update(i, { degree: ev.target.value })} />
            <Input label="Field" value={e.field} onChange={(ev) => update(i, { field: ev.target.value })} />
          </div>
          <div className="mt-2">
            <Input
              label="Graduation"
              value={e.graduation_date}
              onChange={(ev) => update(i, { graduation_date: ev.target.value })}
            />
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-2 text-sm text-red-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm font-semibold text-[#7c3aed]">
        + Add education
      </button>
    </div>
  );
}

export const ProfileFields = { Basics, Work, Skills, Projects, Education };
