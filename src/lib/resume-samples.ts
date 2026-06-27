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
  // What the body of the cover letter should emphasize for this industry.
  // Different industries care about different things, so the letter should
  // not use one fixed formula. These notes steer the focus of the body.
  coverLetterFocus: string[];
}

// The Stanford guide groups cover letters into situational TYPES, each with a
// slightly different opening and purpose. The app only knows the job text, so
// we infer between the two types that actually apply to an online application:
// a response to a full-time job listing, or a response to an internship listing.
type CoverLetterType = "job-listing" | "internship";

interface CoverLetterTypeStrategy {
  id: CoverLetterType;
  label: string;
  openingGuidance: string[];
  structureGuidance: string[];
}

const COVER_LETTER_TYPES: Record<CoverLetterType, CoverLetterTypeStrategy> = {
  "job-listing": {
    id: "job-listing",
    label: "Letter of Application in Response to a Job Listing (Stanford sample #1)",
    openingGuidance: [
      "Open by naming the exact position and stating that this letter and the attached resume are the candidate's application for it.",
      "Say where the role was seen if the job link or description implies a source, otherwise keep it simple.",
      "In one sentence, state why the candidate's skills, academic training, and experience fit this specific role.",
    ],
    structureGuidance: [
      "Use 3 to 4 body paragraphs total.",
      "Body 1: the degree or background and the broad skills it built that the role needs.",
      "Body 2: one concrete, relevant experience explained in real detail, with what was done and the result.",
      "Optional body 3: a second concrete experience or a leadership example, only if there is real content for it.",
      "Closing: restate fit modestly and invite a conversation or interview.",
    ],
  },
  internship: {
    id: "internship",
    label: "Letter of Application in Response to an Internship Listing (Stanford sample #2)",
    openingGuidance: [
      "Open by stating the candidate is writing to apply for the specific internship, and where it was posted if known.",
      "Name the candidate's year and major and a genuine, specific reason for interest in this company or field.",
      "Show early-career motivation and direction rather than claiming senior expertise.",
    ],
    structureGuidance: [
      "Use 3 to 4 short body paragraphs total.",
      "Body 1: genuine interest in the field or company, tied to something concrete, not generic enthusiasm.",
      "Body 2: the most relevant prior experience (internship, project, coursework, or campus role) and what it prepared the candidate to do.",
      "Optional body 3: one specific detail about the company's work or product that shows the candidate did their homework.",
      "Closing: express availability for an interview and thank the reader.",
    ],
  },
};

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
    coverLetterFocus: [
      "Lead with motivation and direction: why this field and this team, grounded in something real.",
      "Show transferable readiness from coursework, projects, campus roles, or part-time work.",
      "Keep claims modest and potential-focused; do not overstate seniority.",
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
    coverLetterFocus: [
      "Emphasize quantified impact, ownership, and structured problem solving.",
      "Show business judgment and stakeholder or client communication.",
      "Tie one analytical or operational result directly to what the role needs.",
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
    coverLetterFocus: [
      "Lead with concrete technical work: what was built, optimized, debugged, or delivered, and with which tools.",
      "Name the 2 to 4 most relevant technologies, not a laundry list.",
      "Keep the tone practical and evidence-based rather than narrative.",
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
    coverLetterFocus: [
      "Emphasize research questions, methods, analysis, and rigor over generic teamwork.",
      "Show intellectual curiosity tied to the specific lab, team, or problem area.",
      "Detail one or two relevant studies or projects, including the approach and finding.",
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
    coverLetterFocus: [
      "Open with genuine mission alignment, tied to a real experience rather than sentiment.",
      "Emphasize writing, research, stakeholder engagement, and program execution.",
      "Show knowledge of the issue area and a concrete way the candidate can contribute.",
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
    coverLetterFocus: [
      "Connect motivation for the field with concrete clinical, research, or patient-facing work.",
      "Emphasize responsibility, empathy, rigor, and trustworthiness through real actions.",
      "Show readiness to contribute reliably within structured, compliant environments.",
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
    coverLetterFocus: [
      "Open with specific, genuine interest in the brand, audience, or creative direction.",
      "Emphasize content, communication, campaigns, events, or production with real outputs.",
      "Use vivid but professional language; keep it scannable for non-creative readers.",
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
    coverLetterFocus: [
      "Tie international, cross-cultural, or language exposure directly to the role or region.",
      "Emphasize research, fieldwork, and stakeholder navigation across contexts.",
      "Show composure and analytical judgment rather than grandiose claims.",
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
    coverLetterFocus: [
      "Use a clean, standard application-letter structure.",
      "Lead with the strongest, most relevant evidence of fit.",
      "Be specific and concise; cut anything that could apply to any company.",
    ],
  },
};

function pickCoverLetterType(jobLink: string, jobDescription: string): CoverLetterType {
  const combined = `${jobLink}\n${jobDescription}`.toLowerCase();
  const internshipSignals = countMatches(combined, [
    "intern",
    "internship",
    "co-op",
    "co op",
    "summer analyst",
    "summer associate",
    "trainee",
    "apprentice",
  ]);
  return internshipSignals > 0 ? "internship" : "job-listing";
}

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

export function buildCoverLetterGuidance(
  profile: FullProfile,
  jobLink: string,
  jobDescription: string
) {
  const strategy = pickResumeSampleStrategy(profile, jobLink, jobDescription);
  const type = COVER_LETTER_TYPES[pickCoverLetterType(jobLink, jobDescription)];

  return [
    `COVER LETTER TYPE TO MODEL: ${type.label}`,
    "Different situations call for different openings and emphasis. Follow the type guidance below; do not force a single fixed template.",
    "Opening guidance for this type:",
    ...type.openingGuidance.map((item) => `- ${item}`),
    "Body structure guidance for this type:",
    ...type.structureGuidance.map((item) => `- ${item}`),
    `INDUSTRY FOCUS TO EMPHASIZE: ${strategy.label}`,
    "Different industries value different evidence. Steer the body of the letter toward what this industry cares about:",
    ...strategy.coverLetterFocus.map((item) => `- ${item}`),
  ].join("\n");
}
