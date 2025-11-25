export const SHIPPING_ZONES = {
  INSIDE_DHAKA: 'inside_dhaka',
  OUTSIDE_DHAKA: 'outside_dhaka',
} as const;

export type ShippingZone = (typeof SHIPPING_ZONES)[keyof typeof SHIPPING_ZONES];

// Dhaka City (urban areas) - considered "Inside Dhaka"
// This includes Dhaka City Corporation areas and main urban neighborhoods
export const DHAKA_CITY_AREAS = [
  // Main areas/neighborhoods
  'dhanmondi', 'ধানমন্ডি',
  'gulshan', 'গুলশান',
  'banani', 'বনানী',
  'uttara', 'উত্তরা',
  'mohakhali', 'মহাখালী',
  'rampura', 'রামপুরা',
  'tejgaon', 'তেজগাঁও',
  'motijheel', 'মতিঝিল',
  'old dhaka', 'পুরান ঢাকা', 'puran dhaka',
  'lalbagh', 'লালবাগ',
  'sutrapur', 'সুত্রাপুর',
  'kotwali', 'কোতয়ালী',
  'sabujbagh', 'সবুজবাগ',
  'demra', 'ডেমরা',
  'shyampur', 'শ্যামপুর',
  'wari', 'ওয়ারী',
  'gandaria', 'গেন্ডারিয়া',
  'khilgaon', 'খিলগাঁও',
  'ramna', 'রমনা',
  'pallabi', 'পল্লবী',
  'mirpur', 'মিরপুর',
  'kafrul', 'কাফরুল',
  'sher-e-bangla nagar', 'শের-ই-বাংলা নগর',
  'cantonment', 'ক্যান্টনমেন্ট',
  'badda', 'বাড্ডা',
  'khilkhet', 'খিলক্ষেত',
  'uttarkhan', 'উত্তরখান',
  'dakshinkhan', 'দক্ষিণখান',
  'jatra bari', 'যাত্রাবাড়ী',
  'shahjahanpur', 'শাহজাহানপুর',
  'bangshal', 'বংশাল',
  'chawkbazar', 'চকবাজার',
  'hazaribagh', 'হাজারীবাগ',
  'kamrangirchar', 'কামরাঙ্গীরচর',
  'tejgaon industrial area', 'তেজগাঁও শিল্প এলাকা',
  'dhanmondi', 'ধানমন্ডি',
  'new market', 'নিউ মার্কেট',
  'farmgate', 'ফার্মগেট',
  'shahbagh', 'শাহবাগ',
  'tikatuli', 'টিকাটুলী',
  'wari', 'ওয়ারী',
  'gopibagh', 'গোপীবাগ',
  'malibagh', 'মালিবাগ',
  'moghbazar', 'মগবাজার',
  'bashabo', 'বাসাবো',
  'shantinagar', 'শান্তিনগর',
  'rampura', 'রামপুরা',
  'banasree', 'বনশ্রী',
  'merul', 'মেরুল',
  'badda', 'বাড্ডা',
  'khilkhet', 'খিলক্ষেত',
  'nikunja', 'নিকুঞ্জ',
  'baridhara', 'বারিধারা',
  'gulshan', 'গুলশান',
  'banani', 'বনানী',
  'tejgaon', 'তেজগাঁও',
  'mohakhali', 'মহাখালী',
  'cantonment', 'ক্যান্টনমেন্ট',
  'uttara', 'উত্তরা',
  'mirpur', 'মিরপুর',
  'kafrul', 'কাফরুল',
  'sher-e-bangla nagar', 'শের-ই-বাংলা নগর',
  'dhanmondi', 'ধানমন্ডি',
  'ramna', 'রমনা',
  'motijheel', 'মতিঝিল',
  'paltan', 'পল্টন',
  'gulistan', 'গুলিস্তান',
  'baitul mukarram', 'বaitul mukarram',
  'purana paltan', 'পুরানা পল্টন',
];

// Districts that are considered "Inside Dhaka" (Dhaka city)
export const DHAKA_CITY_DISTRICTS = [
  'dhaka',
  'ঢাকা',
  'dhaka city',
  'ঢাকা শহর',
];

export const SHIPPING_RULES = {
  dhakaKeywords: ['dhaka', 'ঢাকা'],
  weightThresholdKg: 3,
  fish: {
    [SHIPPING_ZONES.INSIDE_DHAKA]: 100,
    [SHIPPING_ZONES.OUTSIDE_DHAKA]: 150,
  },
  other: {
    [SHIPPING_ZONES.INSIDE_DHAKA]: {
      upToKgFee: 80,
      aboveKgFee: 110,
    },
    [SHIPPING_ZONES.OUTSIDE_DHAKA]: {
      upToKgFee: 110,
      aboveKgFee: 150,
    },
  },
} as const;

