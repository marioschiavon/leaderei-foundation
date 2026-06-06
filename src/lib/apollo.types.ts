// Apollo.io shared types.

export type ApolloPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  github_url?: string | null;
  photo_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  seniority?: string | null;
  departments?: string[] | null;
  phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string; type?: string }> | null;
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    primary_domain?: string;
    industry?: string;
    estimated_num_employees?: number;
    linkedin_url?: string;
  } | null;
};

export type ApolloSearchFilters = {
  q_keywords?: string;
  person_titles?: string[];
  person_seniorities?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  organization_industries?: string[];
  organization_num_employees_ranges?: string[];
  per_page?: number;
  page?: number;
};

export type ApolloSearchResult = {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  fromCache: boolean;
};

export type ApolloConnectionStatus = {
  connected: boolean;
  has_key: boolean;
  credits_remaining: number | null;
  plan: string | null;
  owner_email: string | null;
  last_check_at: string | null;
  display_name: string | null;
  last_error: string | null;
};

export const APOLLO_SENIORITIES = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
  "intern",
] as const;

export const APOLLO_EMPLOYEE_RANGES = [
  "1,10",
  "11,20",
  "21,50",
  "51,100",
  "101,200",
  "201,500",
  "501,1000",
  "1001,2000",
  "2001,5000",
  "5001,10000",
  "10001+",
] as const;
