import slugify from "slugify";

/**
 * Generate URL-friendly slug from text with proper Bangla support
 * @param {string} text - The text to convert to slug
 * @returns {string} - URL-friendly slug
 */
export const generateSlug = (text) => {
  if (!text) return '';
  
  // For Bangla text, create a transliterated slug
  const banglaToEnglish = {
    // Vowels
    'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'এ': 'e', 'ঐ': 'ai', 'ও': 'o', 'ঔ': 'au',
    // Consonants
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'y', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    // Vowel signs
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ে': 'e', 'ৈ': 'ai', 'ো': 'o', 'ৌ': 'au',
    // Other signs
    '্': '', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n'
  };
  
  // Check if text contains Bangla characters
  const hasBangla = /[\u0980-\u09FF]/.test(text);
  
  if (hasBangla) {
    // Transliterate Bangla to English
    let transliterated = text;
    for (const [bangla, english] of Object.entries(banglaToEnglish)) {
      transliterated = transliterated.replace(new RegExp(bangla, 'g'), english);
    }
    return slugify(transliterated, { lower: true, strict: true });
  } else {
    // Use regular slugify for English text
    return slugify(text, { lower: true, strict: true });
  }
};

/**
 * Test function to verify slug generation
 */
export const testSlugGeneration = () => {
  const testCases = [
    { input: 'ঘি', expected: 'ghi' },
    { input: 'চাল', expected: 'chal' },
    { input: 'ডাল', expected: 'dal' },
    { input: 'তেল', expected: 'tel' },
    { input: 'Organic Rice', expected: 'organic-rice' },
    { input: 'Fresh Vegetables', expected: 'fresh-vegetables' }
  ];
  
  console.log('Testing slug generation:');
  testCases.forEach(({ input, expected }) => {
    const result = generateSlug(input);
    console.log(`"${input}" -> "${result}" (expected: "${expected}")`);
  });
};
