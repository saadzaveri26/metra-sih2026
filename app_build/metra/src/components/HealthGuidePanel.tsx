"use client";

import { useState } from "react";
import type { HealthGuide } from "@/lib/api";
import { ChevronDownIcon } from "@/components/icons";

const NUTRIENT_LABELS: Record<string, string> = {
  energy_kcal: "Energy",
  protein_g: "Protein",
  carbohydrate_g: "Carbohydrate",
  total_sugar_g: "Sugars",
  total_fat_g: "Total Fat",
  saturated_fat_g: "Saturated Fat",
  sodium_mg: "Sodium",
};

const NUTRIENT_UNITS: Record<string, string> = {
  energy_kcal: "kcal",
  protein_g: "g",
  carbohydrate_g: "g",
  total_sugar_g: "g",
  total_fat_g: "g",
  saturated_fat_g: "g",
  sodium_mg: "mg",
};

export default function HealthGuidePanel({
  guide,
}: {
  guide: HealthGuide | undefined;
}) {
  const [open, setOpen] = useState(true);

  if (!guide) return null;

  const hasAnything =
    guide.ingredients_text ||
    guide.allergens.length > 0 ||
    guide.health_flags.length > 0 ||
    Object.keys(guide.nutrition_facts).length > 0 ||
    guide.veg_status;

  if (!hasAnything) return null;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-outline-variant px-4 py-3"
      >
        <div>
          <h2 className="text-base font-bold text-on-surface text-left">
            Consumer Health Guide
          </h2>
          <p className="label-caps text-on-surface-variant text-left">
            Ingredients, allergens & nutrition — for shopper awareness
          </p>
        </div>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 px-4 py-4">
          {guide.veg_status && (
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                guide.veg_status === "Vegetarian"
                  ? "bg-compliant-container text-compliant"
                  : "bg-violation-container text-violation"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  guide.veg_status === "Vegetarian" ? "bg-compliant" : "bg-violation"
                }`}
              />
              {guide.veg_status}
            </span>
          )}

          {guide.allergens.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-on-surface">
                Allergen Alert
              </p>
              <div className="flex flex-wrap gap-1.5">
                {guide.allergens.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-violation-container px-2.5 py-1 text-[11px] font-semibold capitalize text-violation"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {guide.health_flags.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-on-surface">
                Things to Know
              </p>
              <ul className="flex flex-col gap-1">
                {guide.health_flags.map((f) => (
                  <li
                    key={f.code}
                    className="rounded-lg bg-review-container px-3 py-1.5 text-xs text-review"
                  >
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.ingredients_list && guide.ingredients_list.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-on-surface">
                Ingredients
              </p>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                {guide.ingredients_list.join(", ")}
              </p>
            </div>
          )}

          {Object.keys(guide.nutrition_facts).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-on-surface">
                Nutrition (as printed, per label serving)
              </p>
              <div className="overflow-hidden rounded-lg border border-outline-variant">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-outline-variant">
                    {Object.entries(guide.nutrition_facts).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-3 py-1.5 text-on-surface-variant">
                          {NUTRIENT_LABELS[key] ?? key}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-on-surface">
                          {value}
                          {NUTRIENT_UNITS[key] ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] italic text-on-surface-variant">
            {guide.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
