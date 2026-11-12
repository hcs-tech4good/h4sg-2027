"use client";

import { H4SG_FIELDS, isH4sgFieldVisible, wordCount, type H4sgDetails } from "@/lib/h4sg-application";
import { MarineIcon, type MarineKind } from "@/components/marine-art";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function H4sgApplicationFields({ value, onChange }: {
  value: H4sgDetails;
  onChange: (key: string, answer: string | string[]) => void;
}) {
  const groups = [...new Set(H4SG_FIELDS.map((f) => f.group))];
  return <div className="space-y-8">
    <div className="rounded-lg bg-teal-50 p-4 text-sm leading-relaxed text-teal-950 space-y-3">
      <p>Hack 4 Social Good is a 48-hour hackathon hosted by Harvard Tech for Social Good (T4SG), March 5–7, 2027 in Cambridge, Massachusetts. Build technology for real social challenges from sponsors and nonprofit partners. Track, judging, prize, and logistics details will follow closer to the event.</p>
      <p>All academic backgrounds and experience levels are welcome. No prior hackathon experience is required; workshops and mentors will help you learn.</p>
      <p>Apply individually and list up to three preferred teammates. Preferences are considered where possible; incomplete teams may be matched. Teams generally have two to four members, depending on matching availability. You can meet teammates through Discord after acceptance or at the event’s team-formation table. Larger teams do not receive a judging advantage.</p>
      <p>Full attendance is expected. Explain any exceptions below for case-by-case consideration. Questions? <a className="underline" href="mailto:operations@t4sg.dev">operations@t4sg.dev</a>.</p>
      <p>Your phone, university, major, and resume are collected in the earlier sections. Complete those too. All questions below are required when shown; group applicants must name at least one teammate.</p>
    </div>
    {groups.map((group, groupIndex) => <fieldset key={group} className="space-y-5 rounded-lg border p-4 sm:p-6">
      <legend className="px-2 text-lg font-semibold"><span className="marine-card-title"><MarineIcon kind={(["fish", "turtle", "shell", "jellyfish", "coral", "starfish"] as MarineKind[])[groupIndex]} />{group}</span></legend>
      {H4SG_FIELDS.filter((f) => f.group === group && isH4sgFieldVisible(f, value)).map((field) => {
        const answer = value[field.key];
        const id = `h4sg-${field.key}`;
        const helpId = `${id}-help`;
        const text = typeof answer === "string" ? answer : "";
        const selected = Array.isArray(answer) ? answer : [];
        return <div key={field.key} className="space-y-2">
          <label htmlFor={id} className="block text-sm font-medium">{field.label} *</label>
          {field.help && <p id={helpId} className="text-sm text-gray-600">{field.help}</p>}
          {field.key === "event_code_of_conduct" && <a href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md" target="_blank" rel="noopener noreferrer" className="block text-sm text-teal-700 underline">Read the Code of Conduct</a>}
          {field.kind === "multi" ? <div id={id} role="group" aria-label={field.label} aria-describedby={field.help ? helpId : undefined} className="grid gap-2 sm:grid-cols-2">
            {field.options?.map((option) => <label key={option} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={selected.includes(option)} onChange={(e) => onChange(field.key, e.target.checked ? [...selected, option] : selected.filter((x) => x !== option))} />{option}
            </label>)}
          </div> : field.kind === "teammates" ? <div id={id} className="space-y-2">
            {[0, 1, 2].map((index) => <Input key={index} aria-label={`Preferred teammate ${index + 1} full name`} placeholder={`Teammate ${index + 1} full name${index ? " (optional)" : ""}`} value={selected[index] || ""} maxLength={200} onChange={(e) => {
              const names = [...selected]; names[index] = e.target.value; onChange(field.key, names);
            }} />)}
          </div> : field.kind === "select" ? <select id={id} value={text} aria-describedby={field.help ? helpId : undefined} className="w-full rounded-md border bg-white px-3 py-2 text-sm" onChange={(e) => onChange(field.key, e.target.value)}>
            <option value="">Select an answer…</option>
            {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
          </select> : field.kind === "textarea" ? <>
            <Textarea id={id} value={text} rows={4} maxLength={10000} aria-describedby={field.help ? helpId : undefined} onChange={(e) => onChange(field.key, e.target.value)} />
            {field.maxWords && <p aria-live="polite" className={`text-xs ${wordCount(text) > field.maxWords ? "text-red-700" : "text-gray-500"}`}>{wordCount(text)} / {field.maxWords} words</p>}
          </> : <Input id={id} type={field.kind === "email" ? "email" : "text"} maxLength={10000} value={text} aria-describedby={field.help ? helpId : undefined} onChange={(e) => onChange(field.key, e.target.value)} />}
        </div>;
      })}
    </fieldset>)}
  </div>;
}
