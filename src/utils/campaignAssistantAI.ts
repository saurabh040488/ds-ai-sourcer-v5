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

RESPONSE FORMAT:
Always respond with a JSON object containing:
{
  "message": "Your conversational response to the user",
  "suggestions": ["array", "of", "helpful", "suggestions"],
  "campaignDraft": {
    "goal": "user's campaign goal",
    "matchedExampleId": "id-of-best-matching-example",
    "type": "campaign-type-from-matched-example",
    ...other draft fields
  },
  "nextStep": "goal|audience|tone|context|review|generate",
  "isComplete": false
}

GUIDELINES:
- Be conversational and helpful
- Ask one question at a time
- Provide specific suggestions based on available campaign examples
- For audience suggestions, prioritize insights from recent searches when available
- Match user goals to existing campaign examples when possible
- Keep responses concise but informative
- Always include relevant suggestions to guide the user
- Update the campaignDraft with collected information
- Set isComplete to true only when ready to generate the campaign
- CRITICAL: Always include matchedExampleId when a goal is identified

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

Please process this input, classify against available campaign examples, and provide the next step in the campaign creation process. Include matchedExampleId in the campaignDraft when a goal is identified.`;

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
      campaignDraft: { ...currentDraft, ...parsedResponse.campaignDraft },
      nextStep: parsedResponse.nextStep || determineNextStep(currentDraft),
      isComplete: parsedResponse.isComplete || false
    };

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

  const systemPrompt = `You are an expert email campaign generator. Create a professional email sequence based on the provided campaign draft and matching example guideline.

CAMPAIGN EXAMPLE GUIDELINE:
${JSON.stringify(matchingExample, null, 2)}

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
- Incorporate the specified tone and target audience
- Use the guideline structure but adapt content to the specific draft`;

  const userPrompt = `Campaign Draft:
${JSON.stringify(draft, null, 2)}

Generate the complete campaign with email sequence using the guideline structure.`;

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
      campaignData: result.campaignData,
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
  if (!draft.tone) return 'selecting the campaign tone';
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
        // Use recent searches directly as suggestions
        recentSearches.slice(0, 4) :
        // Default suggestions if no recent searches
        [
          "Healthcare professionals nationwide",
          "Registered nurses in specific locations",
          "New graduates entering healthcare",
          "Experienced specialists in oncology/ICU"
        ]
    },
    tone: {
      message: "Perfect! What tone would you like for your campaign communications?",
      suggestions: ["Professional", "Friendly", "Casual", "Formal"]
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
    campaignDraft: currentDraft,
    nextStep,
    isComplete: false
  };
}

function createFallbackCampaign(draft: CampaignDraft, example: CampaignExample): {
  campaignData: any;
  emailSteps: EmailStep[];
} {
  console.log('🔄 Creating fallback campaign...');
  
  const campaignData = {
    name: draft.goal.substring(0, 50) + (draft.goal.length > 50 ? '...' : ''),
    type: example.campaignType,
    targetAudience: draft.targetAudience,
    campaignGoal: draft.goal,
    tone: draft.tone,
    companyName: draft.companyName,
    recruiterName: draft.recruiterName,
    contentSources: example.collateralToUse,
    aiInstructions: draft.additionalContext
  };

  const emailSteps: EmailStep[] = example.sequenceAndExamples.examples.map((exampleTitle, index) => ({
    id: `step-${index + 1}`,
    type: 'email',
    subject: `{{First Name}}, ${exampleTitle.toLowerCase()}`,
    content: `Hi {{First Name}},

I hope this message finds you well. ${exampleTitle} at {{Company Name}}.

${draft.additionalContext || 'We have exciting opportunities that align with your background and career goals.'}

Best regards,
${draft.recruiterName}`,
    delay: index === 0 ? 0 : index * 2,
    delayUnit: index === 0 ? 'immediately' : 'business days'
  }));

  return { campaignData, emailSteps };
}