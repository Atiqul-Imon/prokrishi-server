export const SHIPPING_ZONES = {
  INSIDE_DHAKA: 'inside_dhaka',
  OUTSIDE_DHAKA: 'outside_dhaka',
} as const;

export type ShippingZone = (typeof SHIPPING_ZONES)[keyof typeof SHIPPING_ZONES];

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

