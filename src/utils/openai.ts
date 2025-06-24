import OpenAI from 'openai';
import { getAIModelForTask, getPromptForTask } from '../config/ai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo purposes
});

// Logging utility for OpenAI interactions
const logAIInteraction = (operation: string, prompt: string, response: string, metadata?: any) => {
  console.group(`🤖 AI ${operation}`);
  console.log('📤 PROMPT SENT:', prompt);
  console.log('📥 RESPONSE RECEIVED:', response);
  if (metadata) {
    console.log('📊 METADATA:', metadata);
  }
  console.groupEnd();
};

const logError = (operation: string, error: any, context?: any) => {
  console.group(`❌ ERROR in ${operation}`);
  console.error('Error:', error);
  if (context) {
    console.log('Context:', context);
  }
  console.groupEnd();
};

export interface CampaignPrompt {
  campaignType: string;
  targetAudience: string;
  campaignGoal: string;
  contentSources: string[];
  aiInstructions: string;
  tone: string;
  emailLength?: 'short' | 'concise' | 'medium' | 'long';
  companyName: string;
  recruiterName: string;
}

export interface EmailStep {
  id: string;
  type: 'email' | 'connection';
  subject: string;
  content: string;
  delay: number;
  delayUnit: 'immediately' | 'business days';
}

export async function generateCampaignSequence(prompt: CampaignPrompt): Promise<EmailStep[]> {
  console.log('📧 Starting campaign sequence generation...');
  console.log('📊 Campaign Parameters:', prompt);

  // Get AI configuration for campaign generation
  const modelConfig = getAIModelForTask('campaignGeneration');
  const promptConfig = getPromptForTask('campaignGeneration');

  // Define email length specifications
  const emailLengthSpecs = {
    short: { range: '30-50 words', description: 'Brief and to the point' },
    concise: { range: '60-80 words', description: 'Balanced and focused' },
    medium: { range: '100-120 words', description: 'Detailed but readable' },
    long: { range: '150+ words', description: 'Comprehensive and thorough' }
  };

  const lengthSpec = emailLengthSpecs[prompt.emailLength || 'concise'];

  const systemPrompt = `${promptConfig.system}

Campaign Type: ${prompt.campaignType}
Target Audience: ${prompt.targetAudience}
Campaign Goal: ${prompt.campaignGoal}
Company: ${prompt.companyName}
Recruiter: ${prompt.recruiterName}
Tone: ${prompt.tone}

EMAIL LENGTH REQUIREMENTS:
- Target length: ${lengthSpec.range} (${lengthSpec.description})
- CRITICAL: Each email must be approximately ${lengthSpec.range}. This is a strict requirement.

Content Sources:
${prompt.contentSources.join('\n')}

Additional Instructions:
${prompt.aiInstructions}`;

  try {
    console.log('📤 Sending campaign generation request to OpenAI...');
    console.log('🔧 Using model:', modelConfig.model, 'with config:', modelConfig);
    
    const completion = await openai.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Generate the email sequence based on the provided parameters. CRITICAL: Each email must be ${lengthSpec.range} in length with a ${prompt.tone} tone.`
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Log the AI interaction
    logAIInteraction('Campaign Generation', 
      `System: ${systemPrompt}\n\nUser: Generate the email sequence based on the provided parameters.`, 
      response,
      {
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
        usage: completion.usage,
        campaignType: prompt.campaignType,
        emailLength: prompt.emailLength || 'concise'
      }
    );

    // Parse the JSON response
    const emailData = JSON.parse(response);
    
    // Convert to EmailStep format with proper validation
    const emailSteps: EmailStep[] = emailData.map((email: any, index: number) => {
      // Ensure delayUnit is valid
      let delayUnit: 'immediately' | 'business days' = 'business days';
      if (index === 0) {
        delayUnit = 'immediately';
      } else if (email.delayUnit === 'immediately' || email.delayUnit === 'business days') {
        delayUnit = email.delayUnit;
      }

      return {
        id: `step-${index + 1}`,
        type: (email.type === 'connection' ? 'connection' : 'email') as 'email' | 'connection',
        subject: email.subject || `Follow-up ${index + 1}`,
        content: email.content || 'Email content here...',
        delay: Math.max(0, parseInt(email.delay) || (index === 0 ? 0 : index * 2)),
        delayUnit: delayUnit
      };
    });

    console.log('✅ Campaign sequence generated successfully:', emailSteps);
    return emailSteps;
    
  } catch (error) {
    logError('Campaign Generation', error, { prompt });
    
    console.log('🔄 Falling back to default sequence...');
    // Fallback to default sequence if API fails
    
    // Get email length specifications
    const emailLengthSpecs = {
      short: { minWords: 30, maxWords: 50 },
      concise: { minWords: 60, maxWords: 80 },
      medium: { minWords: 100, maxWords: 120 },
      long: { minWords: 150, maxWords: 200 }
    };
    
    const lengthSpec = emailLengthSpecs[prompt.emailLength || 'concise'];
    
    // Create email content based on length preference
    const createEmailContent = (index: number, title: string): string => {
      if (prompt.emailLength === 'short') {
        return `Hi {{First Name}},

I came across your profile and was impressed by your experience. We have exciting opportunities at {{Company Name}} that might interest you.

Would you be open to a brief conversation?

Best regards,
${prompt.recruiterName}`;
      } else if (prompt.emailLength === 'medium') {
        return `Hi {{First Name}},

I hope this message finds you well. I came across your profile and was impressed by your experience in healthcare.

We have some exciting opportunities at {{Company Name}} that I think would be a great fit for your background and career goals. Your experience at {{Current Company}} seems particularly relevant.

Would you be open to a brief conversation about these opportunities? I'd be happy to share more details.

Best regards,
${prompt.recruiterName}`;
      } else if (prompt.emailLength === 'long') {
        return `Hi {{First Name}},

I hope this message finds you well. I came across your profile and was particularly impressed by your experience and background in healthcare.

We have some exciting opportunities at {{Company Name}} that I think would be a great fit for your skills and career goals. Your experience at {{Current Company}} seems particularly relevant to what we're looking for, and I believe you could make a significant impact on our team.

Our organization offers competitive compensation, comprehensive benefits, and a supportive work environment focused on professional growth and development. We're currently expanding our team and looking for talented professionals like yourself.

Would you be open to a brief conversation about these opportunities? I'd be happy to share more details and answer any questions you might have.

Best regards,
${prompt.recruiterName}`;
      } else {
        // Default to concise (60-80 words)
        return `Hi {{First Name}},

I hope this message finds you well. I came across your profile and was impressed by your experience in healthcare.

We have some exciting opportunities at {{Company Name}} that I think would be a great fit for your background and career goals.

Would you be open to a brief conversation about these opportunities?

Best regards,
${prompt.recruiterName}`;
      }
    };
    
    const fallbackSequence: EmailStep[] = [
      {
        id: 'step-1',
        type: 'email',
        subject: '{{First Name}}, interested in a new opportunity?',
        content: createEmailContent(0, 'Opportunity'),
        delay: 0,
        delayUnit: 'immediately'
      },
      {
        id: 'step-2',
        type: 'email',
        subject: 'Following up on healthcare opportunities',
        content: createEmailContent(1, 'Follow-up'),
        delay: 3,
        delayUnit: 'business days'
      },
      {
        id: 'step-3',
        type: 'email',
        subject: 'Last follow-up - {{Company Name}} opportunities',
        content: createEmailContent(2, 'Final follow-up'),
        delay: 5,
        delayUnit: 'business days'
      }
    ];
    
    console.log('🔄 Using fallback sequence:', fallbackSequence);
    return fallbackSequence;
  }
}

export async function generateCampaignName(campaignType: string, targetAudience: string, campaignGoal: string): Promise<string> {
  console.log('📝 Generating campaign name...');
  console.log('📊 Parameters:', { campaignType, targetAudience, campaignGoal });

  // Get AI configuration for campaign naming
  const modelConfig = getAIModelForTask('campaignNaming');
  const promptConfig = getPromptForTask('campaignNaming');

  const userPrompt = `Campaign Type: ${campaignType}\nTarget Audience: ${targetAudience}\nGoal: ${campaignGoal}`;

  try {
    console.log('📤 Sending campaign name generation request to OpenAI...');
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
          content: userPrompt
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    // Log the AI interaction
    logAIInteraction('Campaign Name Generation', 
      `System: ${promptConfig.system}\n\nUser: ${userPrompt}`, 
      response || 'No response',
      {
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
        usage: completion.usage
      }
    );

    const result = response || `${campaignType} Campaign`;
    console.log('✅ Campaign name generated:', result);
    return result;
    
  } catch (error) {
    logError('Campaign Name Generation', error, { campaignType, targetAudience, campaignGoal });
    
    const fallbackName = `${campaignType} Campaign`;
    console.log('🔄 Using fallback name:', fallbackName);
    return fallbackName;
  }
}