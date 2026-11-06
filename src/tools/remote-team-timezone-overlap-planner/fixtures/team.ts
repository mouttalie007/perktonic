import type { Plan } from "../src/logic/overlap";

/** "Try an example": a product team across five zones, including India (+5:30) and Nepal (+5:45). */
export const EXAMPLE_PLAN: Plan = {
  date: "2026-10-28",
  viewZone: "UTC",
  minMinutes: 30,
  people: [
    { name: "Maya (product)", zone: "America/New_York", start: "08:00", end: "16:00", days: [1, 2, 3, 4, 5] },
    { name: "Tom (design)", zone: "Europe/London", start: "09:00", end: "17:30", days: [1, 2, 3, 4, 5] },
    { name: "Lena (backend)", zone: "Europe/Berlin", start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    { name: "Arjun (QA)", zone: "Asia/Kolkata", start: "12:00", end: "21:00", days: [1, 2, 3, 4, 5] },
    { name: "Sita (support)", zone: "Asia/Kathmandu", start: "12:00", end: "20:00", days: [0, 1, 2, 3, 4, 5] },
  ],
};
