import { SHIPPING_RULES, SHIPPING_ZONES, ShippingZone } from '../config/shipping.js';
import { IProduct, IProductVariant, IShippingAddress } from '../types/index.js';

export interface ShippingCalculationResult {
  zone: ShippingZone;
  totalWeightKg: number;
  shippingFee: number;
  breakdown: {
    type: 'fish' | 'other';
    tier: 'flat' | 'under_threshold' | 'over_threshold';
  };
}

export const measurementToKg = (measurement?: number, unit?: string): number => {
  if (!measurement || measurement <= 0) {
    return 0;
  }

  const normalizedUnit = (unit || '').toLowerCase();
  switch (normalizedUnit) {
    case 'kg':
      return measurement;
    case 'g':
      return measurement / 1000;
    default:
      return 0;
  }
};

export const getShippingZone = (address: IShippingAddress): ShippingZone => {
  const district = (address.district || '').toLowerCase();
  const upazila = (address.upazila || '').toLowerCase();
  const addr = (address.address || '').toLowerCase();
  const keywords = SHIPPING_RULES.dhakaKeywords;

  const insideDhaka =
    keywords.some((keyword) => district.includes(keyword)) ||
    keywords.some((keyword) => upazila.includes(keyword)) ||
    keywords.some((keyword) => addr.includes(keyword));

  return insideDhaka ? SHIPPING_ZONES.INSIDE_DHAKA : SHIPPING_ZONES.OUTSIDE_DHAKA;
};

export const calculateItemWeightKg = ({
  product,
  variant,
  quantity,
}: {
  product: IProduct;
  variant?: IProductVariant | null;
  quantity: number;
}): number => {
  if (quantity <= 0) return 0;

  const measurementKg =
    measurementToKg(variant?.measurement, variant?.unit) ||
    measurementToKg(product.measurement, product.unit);

  if (measurementKg > 0) {
    return measurementKg * quantity;
  }

  const unitWeight =
    (variant as any)?.unitWeightKg ??
    (product as any).unitWeightKg ??
    0;

  if (unitWeight > 0) {
    return unitWeight * quantity;
  }

  return 0;
};

export const calculateOtherProductShipping = (
  zone: ShippingZone,
  totalWeightKg: number
): ShippingCalculationResult => {
  const rules = SHIPPING_RULES.other[zone];
  const threshold = SHIPPING_RULES.weightThresholdKg;
  const tier =
    totalWeightKg > threshold ? 'over_threshold' : 'under_threshold';
  const fee =
    totalWeightKg > threshold ? rules.aboveKgFee : rules.upToKgFee;

  return {
    zone,
    totalWeightKg,
    shippingFee: fee,
    breakdown: {
      type: 'other',
      tier,
    },
  };
};

export const calculateFishShipping = (
  zone: ShippingZone
): ShippingCalculationResult => {
  const fee = SHIPPING_RULES.fish[zone];
  return {
    zone,
    totalWeightKg: 0,
    shippingFee: fee,
    breakdown: {
      type: 'fish',
      tier: 'flat',
    },
  };
};

