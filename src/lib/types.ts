export const BLUE = "#7c3aed";
export const BLUE_DARK = "#5b21b6";
export const BLUE_SOFT = "#f5f3ff";

export interface WorkExperience {
  id?: string;
  user_id?: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  currently_working: boolean;
  bullets: string[];
  sort_order?: number;
}

export interface Project {
  id?: string;
  user_id?: string;
  name: string;
  description: string;
  bullets: string[];
  sort_order?: number;
}

export interface Education {
  id?: string;
  user_id?: string;
  school: string;
  degree: string;
  field: string;
  graduation_date: string;
  sort_order?: number;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  resume_file_name?: string | null;
  resume_text?: string | null;
}

export interface ParsedResume {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  work_experience: Omit<WorkExperience, "id" | "user_id">[];
  skills: string[];
  projects: Omit<Project, "id" | "user_id">[];
  education: Omit<Education, "id" | "user_id">[];
}

export interface GeneratedDoc {
  resume: string;
  coverLetter: string;
  tailoringSummary?: string;
}

export interface GenerateResult {
  company: string;
  docs: {
    en?: GeneratedDoc;
    zh?: GeneratedDoc;
  };
}

export interface FullProfile {
  profile: UserProfile;
  work_experience: WorkExperience[];
  skills: { id?: string; name: string; sort_order?: number }[];
  projects: Project[];
  education: Education[];
}

export const emptyParsedResume = (): ParsedResume => ({
  full_name: "",
  email: "",
  phone: "",
  location: "",
  work_experience: [],
  skills: [],
  projects: [],
  education: [],
});
