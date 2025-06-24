import { getAIModelForTask, getPromptForTask } from '../config/ai';
import { openai, cleanJsonResponse, parseJsonSafely, sanitizeJsonString } from './aiUtils';

export interface ExtractedJobData {
  title: string;
  description: string;
  requirements: string[];
  location: string;
  salary_range?: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'temporary';
  company_name?: string;
  reference_number?: string;
  shift_timings?: string;
  apply_url: string;
}

function validateJsonStructure(data: any): ExtractedJobData {
  console.log('✅ Validating JSON structure:', data);
  
  // Ensure all required fields exist with proper types
  const result: ExtractedJobData = {
    title: typeof data.title === 'string' ? data.title : 'Healthcare Professional',
    description: typeof data.description === 'string' ? data.description : 'Join our healthcare team.',
    requirements: Array.isArray(data.requirements) ? data.requirements.filter(req => typeof req === 'string') : ['Professional certification required'],
    location: typeof data.location === 'string' ? data.location : 'Multiple locations',
    salary_range: typeof data.salary_range === 'string' ? data.salary_range : undefined,
    employment_type: ['full-time', 'part-time', 'contract', 'temporary'].includes(data.employment_type) 
      ? data.employment_type 
      : 'full-time',
    company_name: typeof data.company_name === 'string' ? data.company_name : undefined,
    reference_number: typeof data.reference_number === 'string' ? data.reference_number : undefined,
    shift_timings: typeof data.shift_timings === 'string' ? data.shift_timings : undefined,
    apply_url: typeof data.apply_url === 'string' ? data.apply_url : ''
  };
  
  console.log('✅ Validated structure:', result);
  return result;
}

export async function extractJobFromUrl(jobUrl: string): Promise<ExtractedJobData> {
  console.log('🔍 Starting job extraction from URL:', jobUrl);

  // Get AI configuration for job extraction
  const modelConfig = getAIModelForTask('jobExtraction');
  const promptConfig = getPromptForTask('jobExtraction');

  try {
    console.log('📤 Sending job extraction request to OpenAI...');
    console.log('🔧 Using model:', modelConfig.model);
    
    const completion = await openai.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: "system",
          content: promptConfig.system
        },
        {
          role: "user",
          content: `Extract comprehensive job information from this URL: ${jobUrl}

Please extract:
- Job title and description (handle quotes properly)
- Company name and reference number
- Location and shift timings
- Salary range and employment type
- All requirements and qualifications

Return only valid JSON with proper quote escaping.`
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('📥 Raw OpenAI response:', response);

    // Clean the response
    const cleanedResponse = cleanJsonResponse(response);
    
    // Parse JSON with enhanced error handling
    const parsedData = parseJsonSafely(cleanedResponse);
    console.log('✅ JSON parsed successfully:', parsedData);

    // Validate and structure the data
    const result = validateJsonStructure(parsedData);
    
    // Ensure apply_url is set to the original URL
    result.apply_url = jobUrl;

    console.log('✅ Job extraction successful:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error extracting job from URL:', error);
    
    // Provide a more detailed error message
    if (error.message.includes('JSON')) {
      console.error('❌ This appears to be a JSON parsing issue. The AI response may not be properly formatted.');
    }
    
    // Fallback to basic extraction based on URL
    const fallbackResult = createFallbackJobData(jobUrl);
    console.log('🔄 Using fallback job data:', fallbackResult);
    return fallbackResult;
  }
}

function createFallbackJobData(jobUrl: string): ExtractedJobData {
  console.log('🔄 Creating fallback job data for:', jobUrl);
  
  // Try to extract some basic info from URL
  const urlParts = jobUrl.toLowerCase();
  
  let title = 'Healthcare Professional';
  let location = 'Multiple locations';
  let employment_type: 'full-time' | 'part-time' | 'contract' | 'temporary' = 'full-time';
  let company_name = undefined;
  
  // Basic URL pattern matching
  if (urlParts.includes('nurse')) title = 'Registered Nurse';
  else if (urlParts.includes('doctor') || urlParts.includes('physician')) title = 'Physician';
  else if (urlParts.includes('therapist')) title = 'Therapist';
  else if (urlParts.includes('technician')) title = 'Medical Technician';
  else if (urlParts.includes('administrator')) title = 'Healthcare Administrator';
  
  if (urlParts.includes('part-time')) employment_type = 'part-time';
  else if (urlParts.includes('contract')) employment_type = 'contract';
  else if (urlParts.includes('temporary')) employment_type = 'temporary';

  // Try to extract company name from URL
  try {
    const url = new URL(jobUrl);
    const hostname = url.hostname.replace('www.', '');
    const parts = hostname.split('.');
    if (parts.length > 1) {
      company_name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  return {
    title,
    description: `We are seeking a qualified ${title} to join our healthcare team. This position offers an opportunity to make a meaningful impact in patient care while working in a supportive and professional environment.\n\nThe successful candidate will be responsible for providing high-quality healthcare services, collaborating with multidisciplinary teams, and maintaining the highest standards of patient care and safety.\n\nWe offer competitive compensation, comprehensive benefits, and opportunities for professional growth and development.`,
    requirements: [
      'Relevant professional certification/license required',
      'Previous healthcare experience preferred',
      'Strong communication and interpersonal skills',
      'Ability to work effectively in a team environment',
      'Commitment to patient care excellence'
    ],
    location,
    employment_type,
    company_name,
    apply_url: jobUrl
  };
}

export async function generateJobDescription(jobTitle: string, additionalContext?: string): Promise<{
  description: string;
  requirements: string[];
}> {
  console.log('🤖 Generating job description for:', jobTitle);

  // Get AI configuration for job description generation
  const modelConfig = getAIModelForTask('jobExtraction'); // Reuse the same model config
  const promptConfig = getPromptForTask('jobExtraction'); // Reuse the same prompt config

  const systemPrompt = `You are an expert HR professional specializing in healthcare recruitment.

CRITICAL: Respond with ONLY a valid JSON object. No explanatory text, no markdown, no code blocks.
IMPORTANT: Properly escape all quotes and special characters in the JSON response.

Generate a professional job description and requirements. Return this exact JSON structure:

{
  "description": "Professional job description with proper quote escaping",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"]
}

Guidelines:
- Description: 3-4 paragraphs, engaging and professional
- Requirements: 5-8 specific, realistic requirements
- Focus on healthcare industry standards
- Include both technical and soft skills
- Make it appealing to qualified candidates
- Properly escape any quotes or special characters in the text`;

  try {
    const userPrompt = `Job Title: ${jobTitle}${additionalContext ? `\nAdditional Context: ${additionalContext}` : ''}`;
    
    console.log('📤 Sending job description generation request to OpenAI...');
    console.log('🔧 Using model:', modelConfig.model);
    
    const completion = await openai.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('📥 Raw job description response:', response);

    // Clean and parse the response
    const cleanedResponse = cleanJsonResponse(response);
    
    const parsedData = parseJsonSafely(cleanedResponse);
    console.log('✅ Job description JSON parsed successfully');
    
    const result = {
      description: typeof parsedData.description === 'string' ? parsedData.description : `Join our team as a ${jobTitle} and make a meaningful impact in healthcare.`,
      requirements: Array.isArray(parsedData.requirements) ? parsedData.requirements.filter(req => typeof req === 'string') : ['Professional certification required']
    };
    
    console.log('✅ Job description generated successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Error generating job description:', error);
    
    // Fallback job description
    return {
      description: `We are seeking a qualified ${jobTitle} to join our healthcare team. This position offers an opportunity to make a meaningful impact in patient care while working in a supportive and professional environment.\n\nThe successful candidate will be responsible for providing high-quality healthcare services, collaborating with multidisciplinary teams, and maintaining the highest standards of patient care and safety.\n\nWe offer competitive compensation, comprehensive benefits, and opportunities for professional growth and development in a state-of-the-art healthcare facility.`,
      requirements: [
        'Relevant professional certification/license required',
        'Previous healthcare experience preferred',
        'Strong communication and interpersonal skills',
        'Ability to work effectively in a team environment',
        'Commitment to patient care excellence',
        'Proficiency in electronic health records',
        'Current CPR certification'
      ]
    };
  }
}