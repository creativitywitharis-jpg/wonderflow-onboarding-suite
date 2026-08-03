export type OnboardingData = {
  company: string;
  industry: string;
  size: string;
  revenue: string;
  goals: string[];
  stack: string[];
  challenge: string;
};

const KEY = "wf-onboarding";

export const emptyOnboarding: OnboardingData = {
  company: "",
  industry: "",
  size: "",
  revenue: "",
  goals: [],
  stack: [],
  challenge: "",
};

export function saveOnboarding(data: OnboardingData) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function loadOnboarding(): OnboardingData {
  if (typeof window === "undefined") return emptyOnboarding;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...emptyOnboarding, ...JSON.parse(raw) } : emptyOnboarding;
  } catch {
    return emptyOnboarding;
  }
}

export function scoreFor(data: OnboardingData) {
  let base = 42;
  base += Math.min(data.goals.length, 4) * 5;
  base += Math.min(data.stack.length, 5) * 3;
  if (data.revenue) base += 6;
  if (data.size) base += 4;
  if (data.challenge.length > 20) base += 5;
  return Math.max(38, Math.min(94, base));
}