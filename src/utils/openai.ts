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

  const systemPrompt = `${promptConfig.system}

Campaign Type: ${prompt.campaignType}
Target Audience: ${prompt.targetAudience}
Campaign Goal: ${prompt.campaignGoal}
Company: ${prompt.companyName}
Recruiter: ${prompt.recruiterName}
Tone: ${prompt.tone}

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
          content: "Generate the email sequence based on the provided parameters."
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
        campaignType: prompt.campaignType
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
    const fallbackSequence: EmailStep[] = [
      {
        id: 'step-1',
        type: 'email',
        subject: '{{First Name}}, interested in a new opportunity?',
        content: `Hi {{First Name}},

I hope this message finds you well. I came across your profile and was impressed by your experience in healthcare.

We have some exciting opportunities at {{Company Name}} that I think would be a great fit for your background and career goals.

Would you be open to a brief conversation about these opportunities?

Best regards,
${prompt.recruiterName}`,
        delay: 0,
        delayUnit: 'immediately'
      },
      {
        id: 'step-2',
        type: 'email',
        subject: 'Following up on healthcare opportunities',
        content: `Hi {{First Name}},

I wanted to follow up on my previous message about opportunities at {{Company Name}}.

I understand you're likely busy, but I believe these roles could be a significant step forward in your career. We offer competitive compensation, excellent benefits, and a supportive work environment.

Would you have 10 minutes this week for a quick call?

Best,
${prompt.recruiterName}`,
        delay: 3,
        delayUnit: 'business days'
      },
      {
        id: 'step-3',
        type: 'email',
        subject: 'Last follow-up - {{Company Name}} opportunities',
        content: `Hi {{First Name}},

This will be my final follow-up regarding the opportunities at {{Company Name}}.

I wanted to make sure you didn't miss out on these positions that align well with your background. If you're interested in learning more, please feel free to reach out.

If now isn't the right time, I completely understand and wish you all the best in your career.

Best regards,
${prompt.recruiterName}`,
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