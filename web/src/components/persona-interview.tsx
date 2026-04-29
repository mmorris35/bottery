"use client";

import { useState } from "react";

interface InterviewAnswers {
  name: string;
  role: string;
  roleCustom: string;
  audience: string;
  audienceCustom: string;
  tone: string[];
  topics: string;
  boundaries: string;
  signaturePhrases: string;
}

interface PersonaInterviewProps {
  templateName?: string;
  templateContent?: string;
  onComplete: (personaName: string, personaContent: string) => void;
  onBack: () => void;
}

const ROLE_OPTIONS = [
  { value: "strategy-advisor", label: "Strategy Advisor", desc: "Decision frameworks, planning, stakeholder analysis" },
  { value: "executive-assistant", label: "Executive Assistant", desc: "Scheduling, coordination, meeting prep, follow-ups" },
  { value: "technical-partner", label: "Technical Partner", desc: "Code review, architecture, debugging, deployment" },
  { value: "creative-director", label: "Creative Director", desc: "Campaigns, copy, brand voice, content strategy" },
  { value: "deal-strategist", label: "Deal Strategist", desc: "Prospect research, proposals, objection handling" },
  { value: "research-analyst", label: "Research Analyst", desc: "Market research, competitive analysis, data synthesis" },
  { value: "writing-coach", label: "Writing Coach", desc: "Drafting, editing, tone refinement, communication" },
  { value: "custom", label: "Something else", desc: "Describe the role yourself" },
];

const AUDIENCE_OPTIONS = [
  { value: "c-suite", label: "Executives & C-Suite" },
  { value: "managers", label: "Managers & Team Leads" },
  { value: "ics", label: "Individual Contributors" },
  { value: "clients", label: "Clients & Prospects" },
  { value: "mixed", label: "Mixed / Anyone" },
  { value: "custom", label: "Other (specify)" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", desc: "Clear, polished, business-appropriate" },
  { value: "warm", label: "Warm", desc: "Friendly, approachable, encouraging" },
  { value: "direct", label: "Direct", desc: "Blunt, efficient, no fluff" },
  { value: "casual", label: "Casual", desc: "Relaxed, conversational, low-key" },
  { value: "witty", label: "Witty", desc: "Sharp humor, clever, playful" },
  { value: "stoic", label: "Stoic", desc: "Calm, measured, philosophical" },
];

function generatePersona(answers: InterviewAnswers, templateContent?: string): string {
  const name = answers.name.trim();
  const role = answers.role === "custom" ? answers.roleCustom : ROLE_OPTIONS.find(r => r.value === answers.role)?.label ?? answers.role;
  const roleDesc = answers.role === "custom" ? answers.roleCustom : ROLE_OPTIONS.find(r => r.value === answers.role)?.desc ?? "";

  const toneDescriptions = answers.tone.map(t => {
    const opt = TONE_OPTIONS.find(o => o.value === t);
    return opt ? opt.label.toLowerCase() : t;
  });
  const toneStr = toneDescriptions.join(", ");

  const audience = answers.audience === "custom"
    ? answers.audienceCustom
    : AUDIENCE_OPTIONS.find(a => a.value === answers.audience)?.label ?? answers.audience;

  const topicLines = answers.topics
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `- ${l}`)
    .join("\n");

  const boundaryLines = answers.boundaries
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `- ${l}`)
    .join("\n");

  const phraseLines = answers.signaturePhrases
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `- "${l}"`)
    .join("\n");

  const personalityBullets = [];
  if (toneDescriptions.includes("professional")) personalityBullets.push("Clear and polished — every response is business-appropriate");
  if (toneDescriptions.includes("warm")) personalityBullets.push("Genuinely friendly and encouraging — celebrates wins and supports through setbacks");
  if (toneDescriptions.includes("direct")) personalityBullets.push("Cuts to the point — values your time and doesn't pad responses");
  if (toneDescriptions.includes("casual")) personalityBullets.push("Relaxed and conversational — feels like talking to a trusted colleague");
  if (toneDescriptions.includes("witty")) personalityBullets.push("Sharp sense of humor — uses wit to make insights memorable");
  if (toneDescriptions.includes("stoic")) personalityBullets.push("Calm and measured — brings clarity when things feel chaotic");
  if (personalityBullets.length === 0) personalityBullets.push("Helpful and responsive — adapts to what you need");

  let persona = `# ${name} — Telegram Bot Persona

You are ${name}, a ${toneStr} ${role.toLowerCase()} on Telegram.${audience ? ` Your primary audience is ${audience.toLowerCase()}.` : ""}

## Personality

${personalityBullets.map(b => `- ${b}`).join("\n")}
- Keeps responses concise and mobile-friendly
- Asks clarifying questions when the request is ambiguous

## Capabilities

${roleDesc ? `- ${roleDesc}` : "- General assistance and problem-solving"}
${topicLines || "- Adapts to whatever topics you bring"}

## Signature Phrases

${phraseLines || '- "On it."\n- "Here\'s what I\'d suggest."\n- "Let me look into that."'}

## Boundaries

- Never break character in Telegram — you ARE ${name}, always
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
${boundaryLines}`;

  return persona;
}

export function PersonaInterview({ templateName, templateContent, onComplete, onBack }: PersonaInterviewProps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<InterviewAnswers>({
    name: templateName ?? "",
    role: "",
    roleCustom: "",
    audience: "mixed",
    audienceCustom: "",
    tone: ["professional"],
    topics: "",
    boundaries: "",
    signaturePhrases: "",
  });
  const [generatedPersona, setGeneratedPersona] = useState("");
  const [editablePersona, setEditablePersona] = useState("");

  function update<K extends keyof InterviewAnswers>(key: K, value: InterviewAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  function toggleTone(value: string) {
    setAnswers(prev => ({
      ...prev,
      tone: prev.tone.includes(value)
        ? prev.tone.filter(t => t !== value)
        : [...prev.tone, value],
    }));
  }

  function handleGenerate() {
    const persona = generatePersona(answers, templateContent);
    setGeneratedPersona(persona);
    setEditablePersona(persona);
    setStep(4);
  }

  function handleFinish() {
    const name = answers.name.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    onComplete(name, editablePersona);
  }

  return (
    <div className="max-w-2xl">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? "bg-blue-600 text-white" :
              s < step ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-400"
            }`}>
              {s < step ? "✓" : s}
            </div>
            {s < 4 && <div className={`w-8 h-px ${s < step ? "bg-blue-300" : "bg-gray-200"}`} />}
          </div>
        ))}
        <span className="ml-3 text-sm text-gray-500">
          {step === 1 && "Identity"}
          {step === 2 && "Voice & Audience"}
          {step === 3 && "Expertise & Boundaries"}
          {step === 4 && "Review & Finish"}
        </span>
      </div>

      {/* Step 1: Name and Role */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">What should your agent be called?</h2>
            <p className="text-sm text-gray-500 mb-3">This is the name it uses in conversation. Pick something memorable.</p>
            <input
              type="text"
              value={answers.name}
              onChange={e => update("name", e.target.value)}
              placeholder="e.g. Marcus, Scout, Iris"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">What role should it fill?</h2>
            <p className="text-sm text-gray-500 mb-3">Pick the closest match or describe your own.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("role", opt.value)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    answers.role === opt.value
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {answers.role === "custom" && (
              <input
                type="text"
                value={answers.roleCustom}
                onChange={e => update("roleCustom", e.target.value)}
                placeholder="Describe the role..."
                className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button type="button" onClick={onBack} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!answers.name.trim() || !answers.role || (answers.role === "custom" && !answers.roleCustom.trim())}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Tone and Audience */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">What tone should it use?</h2>
            <p className="text-sm text-gray-500 mb-3">Pick one or more. These shape how your agent communicates.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TONE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleTone(opt.value)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    answers.tone.includes(opt.value)
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Who will you be talking to?</h2>
            <p className="text-sm text-gray-500 mb-3">This helps the agent frame its responses appropriately.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("audience", opt.value)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    answers.audience === opt.value
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                </button>
              ))}
            </div>
            {answers.audience === "custom" && (
              <input
                type="text"
                value={answers.audienceCustom}
                onChange={e => update("audienceCustom", e.target.value)}
                placeholder="Describe your audience..."
                className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={answers.tone.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Topics and Boundaries */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">What should it help with?</h2>
            <p className="text-sm text-gray-500 mb-3">List topics, skills, or areas of expertise — one per line. Leave blank for general purpose.</p>
            <textarea
              value={answers.topics}
              onChange={e => update("topics", e.target.value)}
              rows={4}
              placeholder={"Project management and status tracking\nMeeting prep and follow-up\nStakeholder communication drafts\nProcess documentation"}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Anything it should never do or talk about?</h2>
            <p className="text-sm text-gray-500 mb-3">Optional. Set boundaries — one per line.</p>
            <textarea
              value={answers.boundaries}
              onChange={e => update("boundaries", e.target.value)}
              rows={3}
              placeholder={"Never give legal or financial advice\nDon't discuss competitor products by name\nNo political opinions"}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Any signature phrases?</h2>
            <p className="text-sm text-gray-500 mb-3">Optional. Things your agent might say — one per line. Gives it personality.</p>
            <textarea
              value={answers.signaturePhrases}
              onChange={e => update("signaturePhrases", e.target.value)}
              rows={3}
              placeholder={"Let's break this down.\nWhat's the next action here?\nGood call — here's why..."}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button type="button" onClick={() => setStep(2)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Back
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Generate Persona
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review and Edit */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Review your persona</h2>
              <button
                type="button"
                onClick={() => setEditablePersona(generatedPersona)}
                className="text-xs text-blue-600 hover:text-blue-500"
              >
                Reset to generated
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Edit anything you want to change, then continue to deploy settings.</p>
            <textarea
              value={editablePersona}
              onChange={e => setEditablePersona(e.target.value)}
              rows={20}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button type="button" onClick={() => setStep(3)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={!editablePersona.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              Continue to Deploy Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
