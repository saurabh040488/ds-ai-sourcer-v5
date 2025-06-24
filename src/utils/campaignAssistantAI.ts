import OpenAI from 'openai';
import { getAIModelForTask } from '../config/ai';
import { CampaignExample, CampaignDraft, AssistantMessage } from '../types';
import { campaignExamples, findCampaignExampleByGoal, findCampaignExampleById } from '../data/campaignExamples';
import { type EmailStep } from './openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface AssistantResponse {
  message: string;
  suggestions?: string[];
  campaignDraft?: Partial<CampaignDraft>;
  nextStep?: 'goal' | 'audience' | 'tone' | 'context' | 'review' | 'generate';
  isComplete?: boolean;
}

// Utility function to clean markdown code blocks from AI responses
function cleanJsonResponse(response: string): string {
  // Remove markdown code block syntax
  return response
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function processUserInput(
  userInput: string,
  conversationHistory: AssistantMessage[],
  currentDraft: Partial<CampaignDraft>,
  recentSearches: string[] = []
): Promise<AssistantResponse> {
  console.log('🤖 Processing user input with campaign assistant AI...');
  console.log('📝 User input:', userInput);
  console.log('📊 Current draft:', currentDraft);
  console.log('🔍 Recent searches:', recentSearches);

  // Get AI configuration
  const modelConfig = getAIModelForTask('campaignGeneration');

  const systemPrompt = `You are an expert campaign creation assistant for healthcare recruitment. Your role is to help users create effective email campaigns by gathering their requirements and classifying them against proven campaign templates.

AVAILABLE CAMPAIGN EXAMPLES:
${JSON.stringify(campaignExamples, null, 2)}

RECENT SEARCHES CONTEXT:
${recentSearches.length > 0 ? `The user has performed these recent searches: ${recentSearches.join(', ')}. Use these to suggest relevant target audiences when appropriate.` : 'No recent searches available.'}

CLASSIFICATION INSTRUCTIONS:
- Act as a classifier to identify the single best matching CampaignExample from the available examples
- When the user describes their campaign goal, immediately analyze it against all available examples
- Include the "id" of the best-matched example in the campaignDraft as "matchedExampleId"
- This classification should happen as early as possible, ideally when the campaign goal is first identified
- If no perfect match exists, choose the closest example based on campaign type and goal similarity

CONVERSATION FLOW:
1. Goal Identification: Help user define their campaign goal and match it to available examples
2. Audience Definition: Gather details about target audience (prioritize recent searches for suggestions)
3. Tone Selection: Determine appropriate communication tone
4. Additional Context: Collect any specific requirements or context
5. Review & Generate: Confirm details and proceed to generation

CRITICAL FLOW RULE:
- Once the user provides a campaign goal and a matchedExampleId is determined and set in the campaignDraft, the nextStep should automatically transition to 'audience'
- Do NOT wait for further user confirmation for this transition
- Ensure isComplete remains false until all necessary information for generation is collected
- The conversation should flow smoothly without requiring additional user prompts for confirmation at this stage

AUDIENCE STEP SPECIFIC INSTRUCTIONS:
- When in the 'audience' step, if recent searches are available, extract specific target audience descriptions from them
- Put these specific audience suggestions in the "suggestions" array, NOT in the main message
- The main message should be a general question about target audience
- Each suggestion should be a complete, actionable target audience description
- Example suggestions format: ["Oncology Nurses in Denver with 5+ years experience", "Clinical Nurse Specialists in London", "Emergency Room Nurses in New York"]
- Do NOT embed suggestions within the message text - always use the suggestions array
- CRITICAL: When the user provides ANY target audience description (whether from suggestions or their own input), accept it and move to the next step
- Do NOT ask for clarification or selection if the user has provided a clear target audience description
- Recognize that users can provide their own target audience that may not match the suggestions - this is perfectly acceptable

TONE STEP SPECIFIC INSTRUCTIONS:
- When in the 'tone' step, also collect email length preference
- Include both tone and email length options in the suggestions array
- Default email length should be 'concise' if not specified
- Email length options: 'short' (30-50 words), 'concise' (60-80 words), 'medium' (100-120 words), 'long' (150+ words)
- Accept tone input in various formats and automatically include default email length

RESPONSE FORMAT:
Always respond with a JSON object containing:
{
  "message": "Your conversational response to the user",
  "suggestions": ["array", "of", "helpful", "suggestions"],
  "campaignDraft": {
    "goal": "user's campaign goal",
    "matchedExampleId": "id-of-best-matching-example",
    "type": "campaign-type-from-matched-example",
    "emailLength": "short|concise|medium|long",
    ...other draft fields
  },
  "nextStep": "goal|audience|tone|context|review|generate",
  "isComplete": false
}

GUIDELINES:
- Be conversational and helpful
- Ask one question at a time
- Provide specific suggestions based on available campaign examples
- For audience suggestions, prioritize insights from recent searches when available and put them in the suggestions array
- Match user goals to existing campaign examples when possible
- Keep responses concise but informative
- Always include relevant suggestions to guide the user
- Update the campaignDraft with collected information
- Set isComplete to true only when ready to generate the campaign
- CRITICAL: Always include matchedExampleId when a goal is identified
- CRITICAL: Automatically transition to 'audience' step when goal and matchedExampleId are set
- CRITICAL: For audience step, put specific target audience options in suggestions array, not in message text
- CRITICAL: Accept any target audience input from the user and proceed to the next step without asking for clarification
- CRITICAL: For tone step, include email length preference collection

Current conversation context: The user is ${getConversationStage(currentDraft)}`;

  const conversationContext = conversationHistory
    .slice(-6) // Last 6 messages for context
    .map(msg => `${msg.type}: ${msg.content}`)
    .join('\n');

  const userPrompt = `Current draft state: ${JSON.stringify(currentDraft)}

Recent searches: ${recentSearches.join(', ')}

Conversation history:
${conversationContext}

User input: "${userInput}"

Please process this input, classify against available campaign examples, and provide the next step in the campaign creation process. Include matchedExampleId in the campaignDraft when a goal is identified, and automatically transition to 'audience' step when goal is set. For audience step, put specific target audience options in suggestions array. For tone step, include email length collection. CRITICAL: Accept any target audience input and proceed to next step.`;

  try {
    console.log('📤 Sending request to OpenAI...');
    
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
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('📥 AI response received:', response);

    // Clean the response to remove markdown code blocks before parsing
    const cleanedResponse = cleanJsonResponse(response);
    console.log('🧹 Cleaned response:', cleanedResponse);

    // Parse the JSON response
    const parsedResponse = JSON.parse(cleanedResponse);
    
    // Validate and enhance the response
    const result: AssistantResponse = {
      message: parsedResponse.message || "I'm here to help you create your campaign.",
      suggestions: parsedResponse.suggestions || [],
      campaignDraft: { 
        emailLength: 'concise', // Default email length
        ...currentDraft, 
        ...parsedResponse.campaignDraft 
      },
      nextStep: parsedResponse.nextStep || determineNextStep(currentDraft),
      isComplete: parsedResponse.isComplete || false
    };

    // Additional logic to ensure smooth flow
    if (result.campaignDraft?.goal && result.campaignDraft?.matchedExampleId && !currentDraft.goal) {
      // Goal was just set, automatically transition to audience
      result.nextStep = 'audience';
      console.log('🎯 Goal identified and matched, automatically transitioning to audience step');
    }

    // Enhanced audience step handling with recent searches
    if (result.nextStep === 'audience' && recentSearches.length > 0 && (!result.suggestions || result.suggestions.length === 0)) {
      console.log('🎯 Audience step detected with recent searches, generating audience suggestions...');
      
      // Generate audience suggestions from recent searches
      const audienceSuggestions = recentSearches.slice(0, 3).map(search => {
        // Convert search queries to target audience descriptions
        return `Candidates matching: "${search}"`;
      });
      
      result.suggestions = audienceSuggestions;
      result.message = "Great! Now let's define your target audience. Based on your recent searches, I've prepared some options for you to choose from, or you can describe a different audience.";
      
      console.log('✅ Generated audience suggestions from recent searches:', audienceSuggestions);
    }

    // CRITICAL: Handle target audience input detection
    if (currentDraft.goal && !currentDraft.targetAudience && userInput.trim().length > 10) {
      // User has provided substantial input that could be a target audience
      // Check if this looks like a target audience description
      const audienceKeywords = ['candidates', 'nurses', 'professionals', 'specialists', 'workers', 'staff', 'employees', 'people', 'individuals', 'practitioners', 'technicians', 'administrators', 'managers', 'directors', 'coordinators'];
      const locationKeywords = ['in', 'from', 'at', 'near', 'around', 'within'];
      const experienceKeywords = ['years', 'experience', 'experienced', 'senior', 'junior', 'entry', 'level'];
      
      const inputLower = userInput.toLowerCase();
      const hasAudienceKeywords = audienceKeywords.some(keyword => inputLower.includes(keyword));
      const hasLocationKeywords = locationKeywords.some(keyword => inputLower.includes(keyword));
      const hasExperienceKeywords = experienceKeywords.some(keyword => inputLower.includes(keyword));
      
      // If the input contains audience-related keywords or is substantial, treat it as target audience
      if (hasAudienceKeywords || hasLocationKeywords || hasExperienceKeywords || userInput.trim().length > 20) {
        console.log('🎯 Detected target audience input, updating draft and proceeding to tone step');
        result.campaignDraft.targetAudience = userInput.trim();
        result.nextStep = 'tone';
        result.message = `Perfect! I've set your target audience as "${userInput.trim()}". Now, what tone would you like for your campaign communications, and what email length do you prefer?`;
        result.suggestions = [
          "Professional tone, concise emails (60-80 words)",
          "Friendly tone, medium emails (100-120 words)", 
          "Professional tone, short emails (30-50 words)",
          "Warm tone, long emails (150+ words)"
        ];
      }
    }

    // Handle tone and email length input detection
    if (currentDraft.targetAudience && !currentDraft.tone && userInput.trim().length > 5) {
      const toneKeywords = ['professional', 'friendly', 'casual', 'warm', 'formal'];
      const lengthKeywords = ['short', 'concise', 'medium', 'long', 'brief', 'detailed'];
      
      const inputLower = userInput.toLowerCase();
      const hasToneKeywords = toneKeywords.some(keyword => inputLower.includes(keyword));
      const hasLengthKeywords = lengthKeywords.some(keyword => inputLower.includes(keyword));
      
      if (hasToneKeywords || hasLengthKeywords) {
        console.log('🎨 Detected tone/length input, updating draft and proceeding to context step');
        
        // Extract tone
        let detectedTone = 'professional'; // default
        if (inputLower.includes('friendly')) detectedTone = 'friendly';
        else if (inputLower.includes('casual')) detectedTone = 'casual';
        else if (inputLower.includes('warm')) detectedTone = 'warm';
        else if (inputLower.includes('formal')) detectedTone = 'formal';
        
        // Extract email length
        let detectedLength = 'concise'; // default
        if (inputLower.includes('short') || inputLower.includes('brief')) detectedLength = 'short';
        else if (inputLower.includes('medium')) detectedLength = 'medium';
        else if (inputLower.includes('long') || inputLower.includes('detailed')) detectedLength = 'long';
        
        result.campaignDraft.tone = detectedTone;
        result.campaignDraft.emailLength = detectedLength as 'short' | 'concise' | 'medium' | 'long';
        result.nextStep = 'context';
        result.message = `Great choice on the ${detectedTone} tone and ${detectedLength} email length! We'll ensure the emails maintain a ${detectedTone} tone and are ${detectedLength} in length. Let's move on to gather any additional context or specific requirements you might have for this campaign. Is there any particular information or detail you'd like to include?`;
        result.suggestions = [
          "Include company benefits information",
          "Focus on career development opportunities", 
          "Highlight work-life balance",
          "Emphasize competitive compensation"
        ];
      }
    }

    console.log('✅ Processed AI response:', result);
    return result;

  } catch (error) {
    console.error('❌ Error processing user input:', error);
    
    // Fallback response
    return createFallbackResponse(userInput, currentDraft, recentSearches);
  }
}

export async function generateCampaignFromDraft(draft: CampaignDraft): Promise<{
  campaignData: any;
  emailSteps: EmailStep[];
}> {
  console.log('🎯 Generating campaign from draft:', draft);

  // Find matching campaign example using matchedExampleId first, then fallback to goal matching
  let matchingExample: CampaignExample | null = null;
  
  if (draft.matchedExampleId) {
    console.log('🔍 Looking for example by ID:', draft.matchedExampleId);
    matchingExample = findCampaignExampleById(draft.matchedExampleId);
  }
  
  if (!matchingExample) {
    console.log('🔄 Falling back to goal-based matching for:', draft.goal);
    matchingExample = findCampaignExampleByGoal(draft.goal);
  }
  
  if (!matchingExample) {
    throw new Error('No matching campaign example found. Cannot proceed without a guideline.');
  }

  console.log('📋 Using campaign example:', matchingExample);

  // Get AI configuration for campaign generation
  const modelConfig = getAIModelForTask('campaignGeneration');

  // Get email length specifications
  const emailLengthSpecs = {
    short: { range: '30-50 words', description: 'Brief and to the point' },
    concise: { range: '60-80 words', description: 'Balanced and focused' },
    medium: { range: '100-120 words', description: 'Detailed but readable' },
    long: { range: '150+ words', description: 'Comprehensive and thorough' }
  };

  const lengthSpec = emailLengthSpecs[draft.emailLength || 'concise'];

  const systemPrompt = `You are an expert email campaign generator. Create a professional email sequence based on the provided campaign draft and matching example guideline.

CAMPAIGN EXAMPLE GUIDELINE:
${JSON.stringify(matchingExample, null, 2)}

EMAIL LENGTH REQUIREMENTS:
- Target length: ${lengthSpec.range} (${lengthSpec.description})
- Tone: ${draft.tone || 'professional'}
- CRITICAL: Each email must be approximately ${lengthSpec.range}. This is a strict requirement.

IMPORTANT: The campaign example structure above is a GUIDELINE and HINT for sequencing your campaign, not a strict template. Use it to understand the flow and approach, but create content that matches the specific draft requirements.

Generate emails that follow the example structure but are personalized for the specific draft requirements.

RESPONSE FORMAT:
Return a JSON object with:
{
  "campaignData": {
    "name": "Campaign name",
    "type": "campaign type",
    "targetAudience": "target audience",
    "campaignGoal": "campaign goal",
    "tone": "tone",
    "emailLength": "email length preference",
    "companyName": "company name",
    "recruiterName": "recruiter name",
    "contentSources": ["array of content sources"],
    "aiInstructions": "additional context"
  },
  "emailSteps": [
    {
      "type": "email",
      "subject": "Email subject with {{First Name}} personalization",
      "content": "Email content with {{First Name}}, {{Company Name}}, {{Current Company}} tokens",
      "delay": 0,
      "delayUnit": "immediately"
    }
  ]
}

IMPORTANT:
- Create ${matchingExample.sequenceAndExamples.steps} email steps
- Use the example progression as a hint: ${matchingExample.sequenceAndExamples.examples.join(' → ')}
- Include personalization tokens: {{First Name}}, {{Company Name}}, {{Current Company}}
- First email should have delay: 0 and delayUnit: "immediately"
- Subsequent emails should have appropriate delays in "business days"
- Make content professional and engaging
- Strictly adhere to the specified email length of ${lengthSpec.range}
- Incorporate the specified tone and target audience
- Use the guideline structure but adapt content to the specific draft`;

  const userPrompt = `Campaign Draft:
${JSON.stringify(draft, null, 2)}

Generate the complete campaign with email sequence using the guideline structure.
CRITICAL: Each email must be ${lengthSpec.range} in length with a ${draft.tone || 'professional'} tone.`;

  try {
    console.log('📤 Sending campaign generation request...');
    
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
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('📥 Campaign generation response received');

    // Clean the response to remove markdown code blocks before parsing
    const cleanedResponse = cleanJsonResponse(response);
    console.log('🧹 Cleaned campaign response:', cleanedResponse);

    // Parse and validate the response
    const result = JSON.parse(cleanedResponse);
    
    // Ensure email steps have proper structure
    const emailSteps: EmailStep[] = result.emailSteps.map((step: any, index: number) => ({
      id: `step-${index + 1}`,
      type: step.type || 'email',
      subject: step.subject || `Follow-up ${index + 1}`,
      content: step.content || 'Email content here...',
      delay: index === 0 ? 0 : (step.delay || (index * 2)),
      delayUnit: index === 0 ? 'immediately' : (step.delayUnit || 'business days')
    }));

    console.log('✅ Campaign generated successfully');
    return {
      campaignData: {
        ...result.campaignData,
        emailLength: draft.emailLength || 'concise' // Ensure emailLength is included
      },
      emailSteps
    };

  } catch (error) {
    console.error('❌ Error generating campaign:', error);
    
    // Fallback campaign generation
    return createFallbackCampaign(draft, matchingExample);
  }
}

function getConversationStage(draft: Partial<CampaignDraft>): string {
  if (!draft.goal) return 'starting the campaign creation process';
  if (!draft.targetAudience) return 'defining their target audience';
  if (!draft.tone) return 'selecting the campaign tone and email length';
  if (!draft.additionalContext) return 'providing additional context';
  return 'reviewing their campaign details';
}

function determineNextStep(draft: Partial<CampaignDraft>): AssistantResponse['nextStep'] {
  if (!draft.goal) return 'goal';
  if (!draft.targetAudience) return 'audience';
  if (!draft.tone) return 'tone';
  if (!draft.additionalContext) return 'context';
  return 'review';
}

function createFallbackResponse(userInput: string, currentDraft: Partial<CampaignDraft>, recentSearches: string[] = []): AssistantResponse {
  console.log('🔄 Creating fallback response...');
  
  const nextStep = determineNextStep(currentDraft);
  
  const fallbackResponses = {
    goal: {
      message: "I'd love to help you create a campaign! What's the main goal you want to achieve with this campaign?",
      suggestions: [
        "Build a talent community for healthcare professionals",
        "Nurture passive candidates with industry insights",
        "Reengage inactive candidates with new opportunities",
        "Provide educational content to boost candidate skills"
      ]
    },
    audience: {
      message: "Great goal! Now, who is your target audience for this campaign?",
      suggestions: recentSearches.length > 0 ? 
        // Use recent searches as audience suggestions
        recentSearches.slice(0, 3).map(search => `Candidates matching: "${search}"`) :
        // Default suggestions if no recent searches
        [
          "Healthcare professionals nationwide",
          "Registered nurses in specific locations",
          "New graduates entering healthcare",
          "Experienced specialists in oncology/ICU"
        ]
    },
    tone: {
      message: "Perfect! What tone would you like for your campaign communications, and what email length do you prefer?",
      suggestions: [
        "Professional tone, concise emails (60-80 words)",
        "Friendly tone, medium emails (100-120 words)", 
        "Professional tone, short emails (30-50 words)",
        "Warm tone, long emails (150+ words)"
      ]
    },
    context: {
      message: "Excellent! Is there any additional context or specific requirements for this campaign?",
      suggestions: [
        "Include company benefits information",
        "Focus on career development opportunities",
        "Highlight work-life balance",
        "Emphasize competitive compensation"
      ]
    },
    review: {
      message: "Let me review your campaign details. Does everything look correct?",
      suggestions: ["Yes, generate the campaign", "Let me make some changes"]
    }
  };
  
  const response = fallbackResponses[nextStep] || fallbackResponses.goal;
  
  return {
    message: response.message,
    suggestions: response.suggestions,
    campaignDraft: {
      ...currentDraft,
      emailLength: currentDraft.emailLength || 'concise' // Default to concise
    },
    nextStep,
    isComplete: false
  };
}

function createFallbackCampaign(draft: CampaignDraft, example: CampaignExample): {
  campaignData: any;
  emailSteps: EmailStep[];
} {
  console.log('🔄 Creating fallback campaign...');
  
  // Get email length specifications
  const emailLengthSpecs = {
    short: { minWords: 30, maxWords: 50 },
    concise: { minWords: 60, maxWords: 80 },
    medium: { minWords: 100, maxWords: 120 },
    long: { minWords: 150, maxWords: 200 }
  };
  
  const lengthSpec = emailLengthSpecs[draft.emailLength || 'concise'];
  
  const campaignData = {
    name: draft.goal.substring(0, 50) + (draft.goal.length > 50 ? '...' : ''),
    type: example.campaignType,
    targetAudience: draft.targetAudience,
    campaignGoal: draft.goal,
    tone: draft.tone,
    emailLength: draft.emailLength || 'concise',
    companyName: draft.companyName,
    recruiterName: draft.recruiterName,
    contentSources: example.collateralToUse,
    aiInstructions: draft.additionalContext
  };

  // Create email content based on length preference
  const createEmailContent = (index: number, title: string): string => {
    const baseContent = `Hi {{First Name}},

I hope this message finds you well. ${title} at {{Company Name}}.

${draft.additionalContext || 'We have exciting opportunities that align with your background and career goals.'}

Best regards,
${draft.recruiterName}`;

    // Adjust content length based on preference
    if (draft.emailLength === 'short') {
      return `Hi {{First Name}},

${title} at {{Company Name}}. ${draft.additionalContext ? draft.additionalContext.split('.')[0] + '.' : 'We have exciting opportunities for you.'}

Best regards,
${draft.recruiterName}`;
    } else if (draft.emailLength === 'medium') {
      return `Hi {{First Name}},

I hope this message finds you well. ${title} at {{Company Name}}.

${draft.additionalContext || 'We have exciting opportunities that align with your background and career goals.'} I believe your experience at {{Current Company}} makes you an excellent fit for our team.

I'd love to discuss how your skills and expertise could contribute to our organization. Would you be available for a brief conversation this week?

Best regards,
${draft.recruiterName}`;
    } else if (draft.emailLength === 'long') {
      return `Hi {{First Name}},

I hope this message finds you well. ${title} at {{Company Name}}.

${draft.additionalContext || 'We have exciting opportunities that align with your background and career goals.'} I've been particularly impressed by your experience at {{Current Company}} and believe you would be a valuable addition to our team.

Our organization offers competitive compensation, comprehensive benefits, and a supportive work environment focused on professional growth and development. We're currently expanding our team and looking for talented professionals like yourself.

I'd love to schedule a time to discuss these opportunities in more detail and answer any questions you might have. Would you be available for a brief conversation this week?

Best regards,
${draft.recruiterName}`;
    } else {
      // Default to concise (60-80 words)
      return baseContent;
    }
  };

  const emailSteps: EmailStep[] = example.sequenceAndExamples.examples.map((exampleTitle, index) => ({
    id: `step-${index + 1}`,
    type: 'email',
    subject: `{{First Name}}, ${exampleTitle.toLowerCase()}`,
    content: createEmailContent(index, exampleTitle),
    delay: index === 0 ? 0 : index * 2,
    delayUnit: index === 0 ? 'immediately' : 'business days'
  }));

  return { campaignData, emailSteps };
}