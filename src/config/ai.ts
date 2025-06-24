// AI Configuration for different models and prompts
interface AIModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  description: string;
}

interface AIPromptConfig {
  system: string;
  description: string;
  category: string;
}

// AI Model configurations for different use cases
export const AI_MODELS: Record<string, AIModelConfig> = {
  // Fast and cost-effective for simple tasks
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
    description: 'Fast, cost-effective model for simple extraction and generation tasks'
  },
  
  // Balanced performance for most tasks
  'gpt-4o': {
    model: 'gpt-4o',
    temperature: 0.5,
    maxTokens: 2000,
    description: 'Balanced model for complex reasoning and content generation'
  },
  
  // High-quality for complex tasks
  'gpt-4': {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 3000,
    description: 'Premium model for complex analysis and creative content'
  },
  
  // Specialized for analysis
  'gpt-4-analysis': {
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 1500,
    description: 'Low temperature for precise analysis and extraction'
  }
};

// Default model assignments for different tasks
export const AI_TASK_MODELS = {
  entityExtraction: 'gpt-4o-mini',
  jobTitleExpansion: 'gpt-4o-mini',
  candidateMatching: 'gpt-4o',
  campaignGeneration: 'gpt-4o',
  jobExtraction: 'gpt-4o-mini',
  companyBranding: 'gpt-4o',
  campaignNaming: 'gpt-4o-mini',
  collateralExtraction: 'gpt-4o'
} as const;

// Configurable prompts for different AI tasks
export const AI_PROMPTS: Record<string, AIPromptConfig> = {
  entityExtraction: {
    category: 'Search',
    description: 'Extract structured entities from natural language search queries',
    system: `You are an expert at extracting structured information from healthcare recruitment search queries. 

Extract the following entities from the user's search query and return them as a JSON object:

{
  "jobTitles": ["array of job titles mentioned or implied, including variations and related roles"],
  "locations": ["array of locations mentioned, including expanded forms"],
  "experienceRange": {
    "min": number or null,
    "max": number or null
  },
  "skills": ["array of skills, specializations, or competencies mentioned"],
  "industries": ["array of industries mentioned"],
  "education": "education requirements if mentioned"
}

IMPORTANT RULES:
1. For job titles, be comprehensive and include variations
2. For locations, expand abbreviations and include variations
3. For experience, extract years mentioned
4. For skills, include both technical and soft skills, specializations
5. Be comprehensive but accurate - expand related terms but don't hallucinate`
  },

  jobTitleExpansion: {
    category: 'Search',
    description: 'Expand job titles to include related roles and variations',
    system: `You are an expert in healthcare job titles and career progression. Given a job title, expand it to include all related, similar, and equivalent positions that a recruiter should consider.

RULES:
1. Include the original title
2. Add common abbreviations and acronyms
3. Include seniority variations (junior, senior, lead, etc.)
4. Add related specializations within the same field
5. Include equivalent titles at different organizations
6. Consider career progression paths (both up and down)
7. Include both formal and informal title variations
8. Focus on healthcare/medical roles primarily
9. Return 5-15 related titles maximum
10. Return as a JSON array of strings`
  },

  candidateMatching: {
    category: 'Search',
    description: 'Analyze candidate match quality with detailed scoring',
    system: `You are an expert healthcare recruiter evaluating candidate matches. 

Analyze how well a candidate matches the search criteria and provide a detailed assessment.

Return your response as a JSON object with this exact structure:
{
  "score": number (0-100),
  "reasons": ["array of specific reasons why this candidate matches or doesn't match"],
  "category": "excellent" | "good" | "potential"
}

SCORING GUIDELINES:
- 90-100: Excellent match (meets all or most key criteria perfectly)
- 70-89: Good match (meets most criteria with minor gaps)
- 50-69: Potential match (meets some criteria, has potential with training/development)
- 30-49: Weak match (significant gaps but some relevance)
- 0-29: Poor match (minimal relevance)

WEIGHTING:
1. Job title alignment (40% weight)
2. Location match (25% weight)
3. Experience level (20% weight)
4. Skills and specializations (15% weight)`
  },

  campaignGeneration: {
    category: 'Campaigns',
    description: 'Generate personalized email campaign sequences',
    system: `You are an expert email marketing specialist for recruitment campaigns. Generate a professional email sequence based on the provided parameters.

Generate a sequence of 3-4 emails with the following structure:
1. Initial outreach email
2. Follow-up email (if no response)
3. Value-add email with content
4. Final touch email (optional)

For each email, provide:
- Subject line (use {{First Name}} for personalization)
- Email body (use {{First Name}}, {{Current Company}}, {{Company Name}} for personalization)
- Appropriate delay between emails

IMPORTANT: For delay_unit, ONLY use these exact values:
- "immediately" (for the first email)
- "business days" (for follow-up emails)

Keep emails professional, personalized, and focused on the campaign goal. Each email should be 100-150 words.

Return the response as a JSON array with this structure:
[
  {
    "type": "email",
    "subject": "Subject line here",
    "content": "Email body here",
    "delay": 0,
    "delayUnit": "immediately"
  }
]`
  },

  jobExtraction: {
    category: 'Job Postings',
    description: 'Extract structured job information from URLs or descriptions',
    system: `You are an expert at analyzing job posting URLs and extracting structured job information.

CRITICAL INSTRUCTIONS:
1. Respond with ONLY a valid JSON object
2. NO explanatory text, NO markdown, NO code blocks
3. Handle quotes and special characters properly in text content
4. Extract ALL available information including company details and job specifics

Extract job information and return this exact JSON structure:

{
  "title": "Job title here",
  "description": "Complete job description with proper quote handling",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "location": "City, State format",
  "salary_range": "Salary range if available or null",
  "employment_type": "full-time",
  "company_name": "Company name if identifiable",
  "reference_number": "Job reference/ID number if available",
  "shift_timings": "Shift information like 'Day Shift', '7am-7pm', etc.",
  "apply_url": "The provided URL"
}

QUOTE HANDLING:
- Properly escape all quotes in string values
- Handle apostrophes and quotation marks in job descriptions
- Ensure valid JSON structure despite complex text content`
  },

  companyBranding: {
    category: 'Company',
    description: 'Extract company branding and culture information',
    system: `You are an expert at analyzing company websites and extracting key branding information for recruitment purposes.

Given a company URL, extract the following information and return it as a JSON object:

{
  "name": "Company Name",
  "description": "Brief company description (2-3 sentences)",
  "industry": "Primary industry",
  "size": "Company size (startup, small, medium, large, enterprise)",
  "location": "Primary location or 'Multiple locations'",
  "values": ["array of company values"],
  "benefits": ["array of employee benefits"],
  "cultureKeywords": ["array of culture-related keywords"],
  "logoUrl": "URL to company logo if found"
}

IMPORTANT GUIDELINES:
1. Focus on information relevant for recruitment and employer branding
2. Extract actual values and benefits mentioned on the website
3. Include culture keywords that would appeal to candidates
4. Keep descriptions concise but informative
5. If information is not available, use reasonable defaults
6. For size, estimate based on available information`
  },

  collateralExtraction: {
    category: 'Company',
    description: 'Extract company collateral for knowledge base',
    system: `You are an AI assistant tasked with extracting and classifying specific collateral from a company's main website and career site for use in a campaign creation module of the Bolt app, a healthcare recruiting platform. Your goal is to automatically process the provided URLs, identify and extract relevant content, and format it for database storage.

Extract the following collateral types:
- newsletters
- benefits
- who_we_are
- mission_statements
- dei_statements
- talent_community_link
- career_site_link
- company_logo

CLASSIFICATION RULES:
- Text for Email Content: Extract full text for newsletters, benefits, who_we_are, mission_statements, and dei_statements
- Links Only: Extract URLs for talent_community_link, career_site_link, and company_logo

Return a JSON array with this structure:
[
  {
    "type": "newsletters" | "benefits" | "who_we_are" | "mission_statements" | "dei_statements" | "talent_community_link" | "career_site_link" | "company_logo",
    "content": "extracted_text_or_link",
    "links": ["associated_hyperlinks"],
    "last_updated": "ISO_timestamp",
    "version": "1.0"
  }
]`
  },

  campaignNaming: {
    category: 'Campaigns',
    description: 'Generate concise, professional campaign names',
    system: `Generate a concise, professional campaign name (3-6 words) based on the campaign parameters. Make it descriptive and actionable.`
  }
};

// Function to get AI model configuration for a specific task
export function getAIModelForTask(task: keyof typeof AI_TASK_MODELS): AIModelConfig {
  const modelKey = AI_TASK_MODELS[task];
  return AI_MODELS[modelKey] || AI_MODELS['gpt-4o-mini'];
}

// Function to get prompt configuration for a specific task
export function getPromptForTask(task: keyof typeof AI_PROMPTS): AIPromptConfig {
  return AI_PROMPTS[task];
}

// Function to update model assignment for a task
export function updateTaskModel(task: keyof typeof AI_TASK_MODELS, modelKey: keyof typeof AI_MODELS): void {
  (AI_TASK_MODELS as any)[task] = modelKey;
  console.log(`🔧 Updated ${task} to use ${modelKey}`);
}

// Function to update prompt for a task
export function updatePrompt(task: keyof typeof AI_PROMPTS, newPrompt: Partial<AIPromptConfig>): void {
  AI_PROMPTS[task] = { ...AI_PROMPTS[task], ...newPrompt };
  console.log(`🔧 Updated prompt for ${task}`);
}

// Export current configuration
export function getAIConfiguration() {
  return {
    models: AI_MODELS,
    taskModels: AI_TASK_MODELS,
    prompts: AI_PROMPTS
  };
}