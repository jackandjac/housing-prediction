const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const money = (v: number) => usd.format(v);
export const moneyCompact = (v: number) => compactUsd.format(v);
export const number = (v: number) => num.format(v);
export const signedMoney = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + usd.format(Math.abs(v));

export function dateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** "square_footage" -> "Square footage" for columns without a display label. */
export function humanize(name: string) {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display labels and units shared by both apps. */
export const FEATURE_LABELS: Record<string, { label: string; unit?: string }> = {
  square_footage: { label: "Living area", unit: "sq ft" },
  bedrooms: { label: "Bedrooms" },
  bathrooms: { label: "Bathrooms" },
  year_built: { label: "Year built" },
  lot_size: { label: "Lot size", unit: "sq ft" },
  distance_to_city_center: { label: "Distance to center", unit: "mi" },
  school_rating: { label: "School rating", unit: "0–10" },
  price: { label: "Price", unit: "$" },
  price_per_sqft: { label: "Price per sq ft", unit: "$" },
};

/** Feature value for display: years without thousands separators, averages of years rounded. */
export function featureValue(name: string, v: number) {
  return name === "year_built" ? String(Math.round(v)) : number(v);
}

export const featureLabel = (name: string) => FEATURE_LABELS[name]?.label ?? humanize(name);
