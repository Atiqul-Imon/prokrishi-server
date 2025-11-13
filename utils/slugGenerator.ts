import slugify from 'slugify';

// Using Unicode escape sequences for Bangla characters to avoid TypeScript parsing issues
const banglaToEnglish: Record<string, string> = {
  '\u0986': 'a', // আ
  '\u0987': 'i', // ই
  '\u0988': 'i', // ঈ
  '\u0989': 'u', // উ
  '\u098A': 'u', // ঊ
  '\u098F': 'e', // এ
  '\u0990': 'ai', // ঐ
  '\u0993': 'o', // ও
  '\u0994': 'au', // ঔ
  '\u0995': 'k', // ক
  '\u0996': 'kh', // খ
  '\u0997': 'g', // গ
  '\u0998': 'gh', // ঘ
  '\u0999': 'ng', // ঙ
  '\u099A': 'ch', // চ
  '\u099B': 'chh', // ছ
  '\u099C': 'j', // জ
  '\u099D': 'jh', // ঝ
  '\u099E': 'ny', // ঞ
  '\u099F': 't', // ট
  '\u09A0': 'th', // ঠ
  '\u09A1': 'd', // ড
  '\u09A2': 'dh', // ঢ
  '\u09A3': 'n', // ণ
  '\u09A4': 't', // ত
  '\u09A5': 'th', // থ
  '\u09A6': 'd', // দ
  '\u09A7': 'dh', // ধ
  '\u09A8': 'n', // ন
  '\u09AA': 'p', // প
  '\u09AB': 'ph', // ফ
  '\u09AC': 'b', // ব
  '\u09AD': 'bh', // ভ
  '\u09AE': 'm', // ম
  '\u09AF': 'y', // য
  '\u09B0': 'r', // র
  '\u09B2': 'l', // ল
  '\u09B6': 'sh', // শ
  '\u09B7': 'sh', // ষ
  '\u09B8': 's', // স
  '\u09B9': 'h', // হ
  '\u09BE': 'a', // া
  '\u09BF': 'i', // ি
  '\u09C0': 'i', // ী
  '\u09C1': 'u', // ু
  '\u09C2': 'u', // ূ
  '\u09C7': 'e', // ে
  '\u09C8': 'ai', // ৈ
  '\u09CB': 'o', // ো
  '\u09CC': 'au', // ৌ
  '\u09CD': '', // ্
  '\u0982': 'ng', // ং
  '\u0983': 'h', // ঃ
  '\u0981': 'n', // ঁ
};

export const generateSlug = (text: string): string => {
  if (!text) return '';

  const hasBangla = /[\u0980-\u09FF]/.test(text);

  if (hasBangla) {
    let transliterated = text;
    for (const [bangla, english] of Object.entries(banglaToEnglish)) {
      transliterated = transliterated.replace(new RegExp(bangla, 'g'), english);
    }
    return slugify(transliterated, { lower: true, strict: true });
  } else {
    return slugify(text, { lower: true, strict: true });
  }
};

export const testSlugGeneration = (): void => {
  const testCases = [
    { input: 'ঘি', expected: 'ghi' },
    { input: 'চাল', expected: 'chal' },
    { input: 'ডাল', expected: 'dal' },
    { input: 'তেল', expected: 'tel' },
    { input: 'Organic Rice', expected: 'organic-rice' },
    { input: 'Fresh Vegetables', expected: 'fresh-vegetables' },
  ];

  console.log('Testing slug generation:');
  testCases.forEach(({ input, expected }) => {
    const result = generateSlug(input);
    console.log(`"${input}" -> "${result}" (expected: "${expected}")`);
  });
};

