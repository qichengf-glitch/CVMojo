import type { FullProfile } from "./types";

type SampleId =
  | "internship"
  | "business"
  | "engineering"
  | "research"
  | "policy"
  | "healthcare"
  | "arts"
  | "international"
  | "general";

interface ResumeSampleStrategy {
  id: SampleId;
  label: string;
  reason: string;
  structure: string[];
  emphasis: string[];
  tone: string[];
  coverLetterNotes: string[];
}

const SAMPLE_LIBRARY: Record<SampleId, Omit<ResumeSampleStrategy, "reason">> = {
  internship: {
    id: "internship",
    label: "Summer / Internship sample",
    structure: [
      "Use a clean student resume order: Education, Experience, Skills, Additional Information.",
      "Keep education near the top and include strong coursework, honors, or campus roles when they help the case.",
      "Favor concise bullets and practical responsibility over overly polished corporate language.",
    ],
    emphasis: [
      "Show readiness, reliability, and transferable skills.",
      "Use campus leadership, tutoring, volunteer work, and part-time jobs if they support the target role.",
      "Keep the resume energetic and focused on potential plus evidence.",
    ],
    tone: [
      "Student-friendly, grounded, and direct.",
      "Confident without sounding senior-level.",
    ],
    coverLetterNotes: [
      "Explain why this internship is a strong next step.",
      "Connect coursework and hands-on experience to immediate contribution.",
    ],
  },
  business: {
    id: "business",
    label: "Business sample",
    structure: [
      "Use a business-style chronological resume with Education, Experience, Leadership, and Skills.",
      "Lead with the strongest analytical, operational, finance, strategy, or market-facing work.",
      "Keep section titles conventional and recruiter-friendly.",
    ],
    emphasis: [
      "Highlight quantified impact, analysis, ownership, communication, and execution.",
      "Show business judgment, stakeholder work, and structured problem solving.",
      "Use metrics whenever the source profile supports them.",
    ],
    tone: [
      "Sharp, efficient, and results-oriented.",
      "Plainspoken and credible, never buzzword-heavy.",
    ],
    coverLetterNotes: [
      "Reference why the company and role match the candidate’s trajectory.",
      "Stress analytical thinking, cross-functional execution, and business communication.",
    ],
  },
  engineering: {
    id: "engineering",
    label: "Engineering sample",
    structure: [
      "Use an engineering-style layout with Education, Relevant Coursework or Projects when helpful, Experience, and Skills.",
      "Surface technical depth early, especially for tools, systems, and build work tied to the job.",
      "Keep project content only when it strengthens the technical match.",
    ],
    emphasis: [
      "Highlight implementation, systems thinking, technical tools, testing, automation, and measurable improvements.",
      "Show what was built, optimized, debugged, or delivered.",
      "Use concrete engineering language instead of vague teamwork phrasing.",
    ],
    tone: [
      "Technical, concise, and evidence-based.",
      "Strong verbs, low fluff, clear scope.",
    ],
    coverLetterNotes: [
      "Point to the most relevant technical work and why it maps to the role.",
      "Keep the letter specific and practical, not overly narrative.",
    ],
  },
  research: {
    id: "research",
    label: "Research / Science sample",
    structure: [
      "Use a research-oriented layout with Education, Research Experience or Work and Research Experience, then Leadership or Skills.",
      "Place research, analysis, publications, thesis, or lab work ahead of generic experience when it is central to the role.",
      "Keep methods, tools, and findings visible but concise.",
    ],
    emphasis: [
      "Highlight study design, experimentation, modeling, analysis, technical methods, and presentation of findings.",
      "Show intellectual ownership, rigor, and evidence handling.",
      "Mention grants, symposiums, thesis work, or independent investigation if they matter.",
    ],
    tone: [
      "Rigorous and precise.",
      "Academic strength without sounding inflated.",
    ],
    coverLetterNotes: [
      "Focus on research fit, methods, and curiosity tied to the lab or team.",
      "Mention one or two technically relevant experiences in detail.",
    ],
  },
  policy: {
    id: "policy",
    label: "Policy / Public Service sample",
    structure: [
      "Use Education, Policy or Public Service Experience, Research or Leadership, and Skills when relevant.",
      "Keep public-facing, advocacy, stakeholder, and program work easy to scan.",
      "Use a mix of policy, research, and service evidence rather than a purely corporate structure.",
    ],
    emphasis: [
      "Highlight writing, research, stakeholder engagement, program execution, and mission alignment.",
      "Show policy analysis, community impact, and cross-sector communication where supported.",
      "Balance service orientation with evidence of execution.",
    ],
    tone: [
      "Mission-aware, thoughtful, and concrete.",
      "Professional and credible, not overly activist or sentimental.",
    ],
    coverLetterNotes: [
      "Tie the candidate’s motivation to the mission and to relevant execution experience.",
      "Show knowledge of the issue area and practical contribution.",
    ],
  },
  healthcare: {
    id: "healthcare",
    label: "Healthcare sample",
    structure: [
      "Use Education, Health Related Experience or Clinical/Research Experience, Leadership, and Skills.",
      "Keep health-related work grouped and prominent.",
      "Use clear role names and settings so recruiters can assess context fast.",
    ],
    emphasis: [
      "Highlight clinical exposure, patient-facing work, health research, public health programs, and care coordination where relevant.",
      "Show responsibility, empathy, rigor, and trustworthiness through concrete actions.",
      "Keep compliance or process details only when they strengthen fit.",
    ],
    tone: [
      "Calm, credible, and service-oriented.",
      "Specific and grounded, not dramatic.",
    ],
    coverLetterNotes: [
      "Connect motivation for the field with practical health-related work.",
      "Show care, reliability, and readiness to contribute in structured environments.",
    ],
  },
  arts: {
    id: "arts",
    label: "Arts / Media sample",
    structure: [
      "Use a related-experience-forward layout with Education, Related Experience, Leadership or Activities, and Skills.",
      "Group creative, publicity, marketing, communications, or production work near the top.",
      "Let the section order support the portfolio story without becoming unconventional.",
    ],
    emphasis: [
      "Highlight content, communication, publicity, events, design, production, and audience impact.",
      "Show taste, initiative, and execution through real outputs and campaigns.",
      "Use role-specific language, but keep the document easy for non-creative recruiters to scan.",
    ],
    tone: [
      "Energetic and polished.",
      "Creative but controlled, never gimmicky.",
    ],
    coverLetterNotes: [
      "Show genuine interest in the brand, audience, or creative direction.",
      "Use vivid but professional language tied to actual work.",
    ],
  },
  international: {
    id: "international",
    label: "International / Global affairs sample",
    structure: [
      "Use Education, Research or Analytical Experience, Leadership or Teamwork, and Languages or Skills.",
      "Keep global, cross-cultural, language, and fieldwork experience visible.",
      "Organize for international-facing credibility rather than generic corporate order.",
    ],
    emphasis: [
      "Highlight research, policy, languages, cross-cultural collaboration, and fieldwork.",
      "Show independent work, global context, and stakeholder navigation.",
      "Use location and context to clarify the scope of international work.",
    ],
    tone: [
      "World-aware, analytical, and composed.",
      "Specific rather than grandiose.",
    ],
    coverLetterNotes: [
      "Tie international exposure directly to the role, region, or issue area.",
      "Show language ability and cross-cultural judgment when relevant.",
    ],
  },
  general: {
    id: "general",
    label: "Chronological / Combination sample",
    structure: [
      "Use a clean chronological or combination resume, whichever best fits the evidence.",
      "Keep the order conventional: Education, Experience, Projects if needed, Skills.",
      "Prefer combination style only when mixed experiences need to be grouped by theme.",
    ],
    emphasis: [
      "Prioritize relevance, clarity, and credible accomplishment.",
      "Use the strongest evidence first and cut low-value detail aggressively.",
      "Keep the story easy for a recruiter to scan in under 30 seconds.",
    ],
    tone: [
      "Professional, concise, and straightforward.",
      "Natural language over formulaic AI phrasing.",
    ],
    coverLetterNotes: [
      "Use a standard application-letter structure.",
      "Be specific about fit and keep the letter concise.",
    ],
  },
};

function countMatches(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
}

export function pickResumeSampleStrategy(
  profile: FullProfile,
  jobLink: string,
  jobDescription: string
): ResumeSampleStrategy {
  const combined = `${jobLink}\n${jobDescription}`.toLowerCase();
  const workCount = profile.work_experience.length;
  const projectCount = profile.projects.length;
  const educationText = profile.education
    .map((item) => `${item.school} ${item.degree} ${item.field}`)
    .join(" ")
    .toLowerCase();

  const businessScore = countMatches(combined, [
    "analyst",
    "consult",
    "consulting",
    "strategy",
    "operations",
    "business",
    "finance",
    "investment",
    "product manager",
    "product management",
    "program manager",
    "market",
    "sales",
    "growth",
  ]);
  const engineeringScore = countMatches(combined, [
    "software",
    "engineer",
    "engineering",
    "developer",
    "robot",
    "manufacturing",
    "mechanical",
    "electrical",
    "systems",
    "automation",
    "data engineer",
    "firmware",
    "hardware",
  ]);
  const researchScore = countMatches(combined, [
    "research",
    "scientist",
    "laboratory",
    "lab",
    "phd",
    "thesis",
    "experiment",
    "modeling",
    "analysis",
    "statistical",
  ]);
  const policyScore = countMatches(combined, [
    "policy",
    "government",
    "public service",
    "public policy",
    "nonprofit",
    "community",
    "advocacy",
    "sustainability",
    "environmental",
    "program",
  ]);
  const healthcareScore = countMatches(combined, [
    "health",
    "healthcare",
    "clinical",
    "medical",
    "patient",
    "public health",
    "hospital",
    "biotech",
    "medicine",
    "care",
  ]);
  const artsScore = countMatches(combined, [
    "marketing",
    "communications",
    "content",
    "media",
    "brand",
    "fashion",
    "design",
    "publicity",
    "creative",
    "events",
    "journalism",
  ]);
  const internationalScore = countMatches(combined, [
    "international",
    "global",
    "foreign",
    "cross-cultural",
    "multilingual",
    "geopolitical",
    "development",
    "humanitarian",
    "ngo",
    "regional",
  ]);

  const internshipHints = countMatches(combined, ["intern", "internship", "summer analyst", "summer associate"]);
  const candidateIsEarlyCareer =
    internshipHints > 0 ||
    (workCount <= 1 && projectCount <= 2) ||
    educationText.includes("bachelor") ||
    educationText.includes("undergraduate");

  const scored: Array<{ id: SampleId; score: number }> = [
    { id: "business", score: businessScore },
    { id: "engineering", score: engineeringScore },
    { id: "research", score: researchScore },
    { id: "policy", score: policyScore },
    { id: "healthcare", score: healthcareScore },
    { id: "arts", score: artsScore },
    { id: "international", score: internationalScore },
  ];

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  let chosen: SampleId = "general";
  let reason = "Default to a clean chronological or combination resume because the job signal is mixed.";

  if (candidateIsEarlyCareer && internshipHints > 0 && best.score <= 2) {
    chosen = "internship";
    reason = "The role looks like an internship or early-career opening, so use a student-friendly sample structure.";
  } else if (best && best.score > 0) {
    chosen = best.id;
    reason = `The job description most closely matches the ${SAMPLE_LIBRARY[best.id].label.toLowerCase()} from the reference PDF.`;
  } else if (candidateIsEarlyCareer) {
    chosen = "internship";
    reason = "The candidate appears early-career, so use the internship-oriented sample as the default reference.";
  }

  return {
    ...SAMPLE_LIBRARY[chosen],
    reason,
  };
}

export function buildResumeSampleGuidance(
  profile: FullProfile,
  jobLink: string,
  jobDescription: string
) {
  const strategy = pickResumeSampleStrategy(profile, jobLink, jobDescription);
  return [
    `REFERENCE SAMPLE TO FOLLOW: ${strategy.label}`,
    `Why this sample: ${strategy.reason}`,
    "Reference structure guidance:",
    ...strategy.structure.map((item) => `- ${item}`),
    "Reference emphasis guidance:",
    ...strategy.emphasis.map((item) => `- ${item}`),
    "Reference tone guidance:",
    ...strategy.tone.map((item) => `- ${item}`),
    "Cover letter guidance from the reference set:",
    ...strategy.coverLetterNotes.map((item) => `- ${item}`),
  ].join("\n");
}
