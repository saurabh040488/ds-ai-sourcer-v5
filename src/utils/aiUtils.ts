import OpenAI from 'openai';

// Initialize OpenAI client once and export it
export const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Logging utility for OpenAI interactions
export const logAIInteraction = (operation: string, prompt: string, response: string, metadata?: any) => {
  console.group(`🤖 AI ${operation}`);
  console.log('📤 PROMPT SENT:', prompt);
  console.log('📥 RESPONSE RECEIVED:', response);
  if (metadata) {
    console.log('📊 METADATA:', metadata);
  }
  console.groupEnd();
};

export const logError = (operation: string, error: any, context?: any) => {
  console.group(`❌ ERROR in ${operation}`);
  console.error('Error:', error);
  if (context) {
    console.log('Context:', context);
  }
  console.groupEnd();
};

// Utility function to clean OpenAI API response from markdown code blocks
export const cleanJsonResponse = (response: string): string => {
  if (!response || typeof response !== 'string') {
    return response;
  }
  
  console.log('🧹 Cleaning JSON response...');
  
  // Remove markdown code block delimiters
  let cleaned = response
    .replace(/^```json\s*/i, '') // Remove opening ```json
    .replace(/^```\s*/i, '')     // Remove opening ```
    .replace(/\s*```\s*$/i, '')  // Remove closing ```
    .trim();                     // Remove any surrounding whitespace

  // If the response starts with explanatory text, try to find the JSON
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart <= jsonEnd) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  
  // Additional cleanup for common issues
  cleaned = cleaned
    .replace(/^\s*[\w\s]*?(?=\{)/g, '') // Remove any text before the first {
    .replace(/\}\s*[\w\s]*$/g, '}')     // Remove any text after the last }
    .trim();
  
  console.log('🧹 Cleaned JSON:', cleaned);
  return cleaned;
};

export function sanitizeJsonString(str: string): string {
  if (typeof str !== 'string') return str;
  
  // Escape quotes and other problematic characters
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t')   // Escape tabs
    .replace(/\f/g, '\\f')   // Escape form feeds
    .replace(/\b/g, '\\b');  // Escape backspaces
}

export function parseJsonSafely(jsonString: string): any {
  console.log('🔍 Attempting to parse JSON safely...');
  
  try {
    // First attempt: direct parsing
    return JSON.parse(jsonString);
  } catch (firstError) {
    console.log('❌ First parse attempt failed:', firstError.message);
    
    try {
      // Second attempt: try to fix common JSON issues
      let fixedJson = jsonString;
      
      // Fix unescaped quotes in string values
      // This regex finds string values and escapes quotes within them
      fixedJson = fixedJson.replace(
        /"([^"]*)":\s*"([^"]*(?:\\.[^"]*)*)"/g,
        (match, key, value) => {
          // Don't double-escape already escaped quotes
          const cleanValue = value.replace(/\\"/g, '"').replace(/"/g, '\\"');
          return `"${key}": "${cleanValue}"`;
        }
      );
      
      // Fix array string values
      fixedJson = fixedJson.replace(
        /"([^"]*)":\s*\[([^\]]*)\]/g,
        (match, key, arrayContent) => {
          // Fix quotes in array elements
          const fixedArrayContent = arrayContent.replace(
            /"([^"]*(?:\\.[^"]*)*)"/g,
            (itemMatch, itemValue) => {
              const cleanItemValue = itemValue.replace(/\\"/g, '"').replace(/"/g, '\\"');
              return `"${cleanItemValue}"`;
            }
          );
          return `"${key}": [${fixedArrayContent}]`;
        }
      );
      
      console.log('🔧 Attempting to parse fixed JSON...');
      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.log('❌ Second parse attempt failed:', secondError.message);
      
      try {
        // Third attempt: manually construct object from key-value pairs
        console.log('🔧 Attempting manual JSON reconstruction...');
        
        const result: any = {};
        
        // Extract basic fields with improved regex
        const extractField = (fieldName: string, defaultValue: any = '') => {
          const regex = new RegExp(`"${fieldName}":\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 'i');
          const match = jsonString.match(regex);
          return match ? match[1].replace(/\\"/g, '"') : defaultValue;
        };
        
        const extractArray = (fieldName: string, defaultValue: any[] = []) => {
          const regex = new RegExp(`"${fieldName}":\\s*\\[(.*?)\\]`, 'is');
          const match = jsonString.match(regex);
          if (match) {
            const arrayContent = match[1];
            const items = arrayContent.match(/"([^"]*(?:\\.[^"]*)*)"/g);
            return items ? items.map(item => item.slice(1, -1).replace(/\\"/g, '"')) : defaultValue;
          }
          return defaultValue;
        };
        
        // Try to extract common fields
        result.score = extractField('score', 0);
        result.reasons = extractArray('reasons', []);
        result.category = extractField('category', 'potential');
        result.title = extractField('title', '');
        result.description = extractField('description', '');
        result.requirements = extractArray('requirements', []);
        result.location = extractField('location', '');
        result.name = extractField('name', '');
        result.industry = extractField('industry', '');
        result.size = extractField('size', '');
        result.values = extractArray('values', []);
        result.benefits = extractArray('benefits', []);
        result.cultureKeywords = extractArray('cultureKeywords', []);
        
        console.log('✅ Manual JSON reconstruction successful:', result);
        return result;
        
      } catch (thirdError) {
        console.error('❌ All JSON parsing attempts failed:', thirdError.message);
        throw new Error(`Failed to parse JSON after multiple attempts: ${firstError.message}`);
      }
    }
  }
}