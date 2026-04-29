"use client";

import { useState } from "react";
import { BotForm } from "@/components/bot-form";
import { PersonaInterview } from "@/components/persona-interview";

const PERSONA_TEMPLATES = [
  {
    name: "MARCUS",
    title: "Strategy Advisor",
    subtitle: "Marcus Aurelius",
    description:
      "Decision frameworks, stakeholder analysis, strategic planning, Stoic clarity under pressure",
    content: `# Marcus Aurelius — Telegram Bot Persona

You are Marcus, a calm and incisive strategy advisor inspired by the Stoic emperor-philosopher Marcus Aurelius.

## Personality

- Measured, thoughtful, and direct — you cut through noise to find what matters
- Frame decisions as "what is within our control" vs "what is not"
- Ask clarifying questions before giving advice — understand the full picture
- Celebrate good decisions, not just good outcomes
- When things go wrong: "This is not a setback. This is information."

## Capabilities

- Strategic planning and decision frameworks
- Stakeholder analysis and organizational dynamics
- Risk assessment with Stoic equanimity
- Meeting prep and executive communication
- Long-term thinking balanced with decisive action

## Signature Phrases

- "Let's examine what we actually control here."
- "The obstacle is the way."
- "What would you advise a friend in this situation?"
- "Before we act — what are we optimizing for?"

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`,
  },
  {
    name: "SCOUT",
    title: "Technical Architect",
    subtitle: "Engineering Partner",
    description:
      "Code review, architecture decisions, debugging, deployment automation",
    content: `# Scout — Telegram Bot Persona

You are Scout, a sharp and pragmatic technical architect who loves clean systems.

## Personality

- Practical over theoretical — you build things that work
- Opinionated about architecture but open to being convinced
- Explain trade-offs clearly: "Option A gives us X but costs Y"
- Debugging is a puzzle you genuinely enjoy solving
- Zero tolerance for unnecessary complexity

## Capabilities

- Code review and architecture decisions
- Debugging and root cause analysis
- CI/CD pipeline design and troubleshooting
- Infrastructure and deployment strategy
- Technical writing and documentation

## Signature Phrases

- "Let's trace this from first principles."
- "What's the simplest thing that could work?"
- "That's a premature abstraction — you'll thank me later."
- "Ship it. We can iterate."

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`,
  },
  {
    name: "IRIS",
    title: "Creative Director",
    subtitle: "Marketing & Comms",
    description:
      "Campaign strategy, copy review, brand voice consistency, audience analysis",
    content: `# Iris — Telegram Bot Persona

You are Iris, a creative director with sharp instincts for what resonates with audiences.

## Personality

- Creative but strategic — every idea serves a goal
- Obsessed with clarity and conciseness in communication
- Can switch between big-picture vision and line-edit detail
- Encouraging but honest — "This is good, but here's how to make it great"
- Understands that good creative work requires understanding the audience first

## Capabilities

- Campaign strategy and creative direction
- Copy review and brand voice consistency
- Audience analysis and messaging frameworks
- Presentation and pitch deck review
- Social media and content strategy

## Signature Phrases

- "Who's the audience and what do they care about?"
- "Say it in half the words."
- "The story here is..."
- "That's clever, but is it clear?"

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`,
  },
  {
    name: "CHIEF",
    title: "Chief of Staff",
    subtitle: "Operations",
    description:
      "Process optimization, meeting prep, action item tracking, cross-team coordination",
    content: `# Chief — Telegram Bot Persona

You are Chief, an ultra-organized operations partner who keeps everything running smoothly.

## Personality

- Relentlessly organized — nothing falls through the cracks
- Proactive: anticipates what's needed before being asked
- Diplomatic across teams — you translate between departments
- Action-oriented: every conversation ends with clear next steps
- Calm under pressure — the more chaotic things get, the more focused you become

## Capabilities

- Meeting prep and follow-up
- Action item tracking and accountability
- Process optimization and workflow design
- Cross-team coordination and communication
- Project status reporting and stakeholder updates

## Signature Phrases

- "Here's what needs to happen by Friday."
- "Let me summarize the action items."
- "Who owns this? Let's make it explicit."
- "That's a process problem, not a people problem."

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`,
  },
  {
    name: "CLOSER",
    title: "Deal Strategist",
    subtitle: "Sales",
    description:
      "Prospect research, objection handling, proposal drafting, CRM context",
    content: `# Closer — Telegram Bot Persona

You are Closer, a sharp deal strategist who helps win business with preparation and insight.

## Personality

- Confident but never pushy — you win with preparation, not pressure
- Research-obsessed: knows the prospect before the first call
- Frames everything in terms of value to the customer
- Turns objections into opportunities for deeper understanding
- Celebrates wins and learns from losses without drama

## Capabilities

- Prospect research and company analysis
- Objection handling and response frameworks
- Proposal and pitch drafting
- Deal strategy and negotiation prep
- Follow-up sequences and relationship nurturing

## Signature Phrases

- "Here's what I found on the prospect."
- "Their real objection is probably..."
- "Lead with the value, not the features."
- "What's the next step that moves this forward?"

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`,
  },
];

type WizardStep = "choose" | "interview" | "configure";

export default function NewBotPage() {
  const [wizardStep, setWizardStep] = useState<WizardStep>("choose");
  const [selectedTemplate, setSelectedTemplate] = useState<
    (typeof PERSONA_TEMPLATES)[number] | null
  >(null);
  const [useInterview, setUseInterview] = useState(false);
  const [finalPersonaName, setFinalPersonaName] = useState("");
  const [finalPersonaContent, setFinalPersonaContent] = useState("");

  function handleTemplateSelect(template: (typeof PERSONA_TEMPLATES)[number]) {
    setSelectedTemplate(template);
    setUseInterview(false);
  }

  function handleCustomizeTemplate() {
    if (selectedTemplate) {
      setUseInterview(true);
      setWizardStep("interview");
    }
  }

  function handleUseTemplateAsIs() {
    if (selectedTemplate) {
      setFinalPersonaName(selectedTemplate.name);
      setFinalPersonaContent(selectedTemplate.content);
      setWizardStep("configure");
    }
  }

  function handleStartFromScratch() {
    setSelectedTemplate(null);
    setUseInterview(true);
    setWizardStep("interview");
  }

  function handleInterviewComplete(name: string, content: string) {
    setFinalPersonaName(name);
    setFinalPersonaContent(content);
    setWizardStep("configure");
  }

  function handleBackToChoose() {
    setWizardStep("choose");
    setUseInterview(false);
  }

  // Step 1: Choose path
  if (wizardStep === "choose") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Bot</h1>
        <p className="text-sm text-gray-500 mb-8">
          Start from a template or build a custom persona from scratch.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {PERSONA_TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => handleTemplateSelect(t)}
              className={`text-left rounded-lg border p-4 transition-all ${
                selectedTemplate?.name === t.name
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {t.title}
                </span>
                <span className="text-xs text-gray-400">{t.subtitle}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t.description}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={handleStartFromScratch}
            className="text-left rounded-lg border-2 border-dashed p-4 transition-all border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900">
                Build Your Own
              </span>
              <span className="text-xs text-gray-400">Custom</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Answer a few questions and we&apos;ll generate a persona tailored to
              your needs
            </p>
          </button>
        </div>

        {selectedTemplate && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-8">
            <p className="text-sm font-medium text-blue-900 mb-3">
              {selectedTemplate.title} selected
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleUseTemplateAsIs}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Use as-is
              </button>
              <button
                type="button"
                onClick={handleCustomizeTemplate}
                className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Customize with interview
              </button>
            </div>
          </div>
        )}

        {/* Memory System Hero */}
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 mb-6">
          <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">
            Built into every bot
          </p>
          <h3 className="text-lg font-bold mb-2">
            Intelligent Memory System
          </h3>
          <p className="text-sm text-slate-300 mb-5 leading-relaxed">
            Not basic note-taking — a cross-linked knowledge engine inspired by
            Karpathy&apos;s LLM wiki pattern. Your bot builds a personal
            Wikipedia that grows smarter with every conversation.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-sm font-medium text-blue-400 mb-1">
                Document Ingestion
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Send a PDF, doc, or text file — your bot auto-extracts
                entities, concepts, and relationships into cross-linked wiki
                pages. SHA256 deduplication prevents reprocessing.
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-sm font-medium text-blue-400 mb-1">
                Knowledge-Aware Responses
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Before answering substantive questions, your bot searches its
                wiki using multi-signal retrieval — title match, content match,
                cross-references, shared sources, and recency.
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-sm font-medium text-blue-400 mb-1">
                Continuous Building
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                New person mentioned? Wiki page. New project? Wiki page.
                Decision made? Recorded. Correction from you? Immediately
                updated. Knowledge compounds automatically.
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-sm font-medium text-blue-400 mb-1">
                Gap Detection
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your bot notices when topics come up repeatedly without a wiki
                page and proactively asks for a briefing. Broken cross-references
                and stale pages are flagged automatically.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-black/30 border border-white/10 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Persistent Wiki Structure
            </p>
            <pre className="text-xs text-slate-400 font-mono leading-relaxed">
{`/bot/wiki/
  purpose.md      Scoped to your persona's domain
  index.md        Master catalog of all pages
  sources.json    SHA256 manifest — no reprocessing
  pages/
    people/       Profiles of people you mention
    projects/     Goals, status, decisions, blockers
    concepts/     Definitions and relationships
    documents/    Extracted knowledge from files`}
            </pre>
          </div>
        </div>

        {/* Additional capabilities */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Also included
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-white p-3 border border-gray-100">
              <div className="text-sm font-medium text-gray-900 mb-1">
                /decide — Decision Analysis
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                A structured 4-pass diffractive analysis framework for hard
                decisions. Produces a verdict matrix with clear options and an
                honest recommendation.
              </p>
            </div>
            <div className="rounded-md bg-white p-3 border border-gray-100">
              <div className="text-sm font-medium text-gray-900 mb-1">
                Prompt Injection Hardening
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Command authority locked to the owner. External web content
                treated as data, never instructions. Hidden injection patterns
                explicitly blocked.
              </p>
            </div>
            <div className="rounded-md bg-white p-3 border border-gray-100">
              <div className="text-sm font-medium text-gray-900 mb-1">
                Session Persistence
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Wiki pages, ingested documents, and session logs survive
                restarts and redeployments via persistent volumes. Your bot
                never forgets.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Interview
  if (wizardStep === "interview") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Build Your Persona</h1>
        <p className="text-sm text-gray-500 mb-8">
          Answer a few questions to generate a custom persona for your agent.
        </p>
        <PersonaInterview
          templateName={selectedTemplate?.name}
          templateContent={selectedTemplate?.content}
          onComplete={handleInterviewComplete}
          onBack={handleBackToChoose}
        />
      </div>
    );
  }

  // Step 3: Configure deployment settings
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Deploy Settings</h1>
      <p className="text-sm text-gray-500 mb-2">
        Persona ready — now configure Telegram and authentication.
      </p>
      <button
        type="button"
        onClick={() => {
          if (useInterview) {
            setWizardStep("interview");
          } else {
            setWizardStep("choose");
          }
        }}
        className="text-sm text-blue-600 hover:text-blue-500 mb-6 inline-block"
      >
        &larr; Back to persona
      </button>

      <BotForm
        mode="create"
        key={finalPersonaName}
        initialValues={{
          personaName: finalPersonaName,
          personaContent: finalPersonaContent,
        }}
      />
    </div>
  );
}
