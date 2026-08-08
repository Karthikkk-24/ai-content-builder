export type PromptTemplate = {
  id: string;
  label: string;
  href: string;
  prompt: string;
  description: string;
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "tweet-launch",
    label: "Product launch tweet",
    href: "/generate/tweets",
    prompt:
      "Announce the launch of a productivity app that helps remote teams ship weekly goals. Keep it punchy and optimistic.",
    description: "Single tweet announcement",
  },
  {
    id: "poster-event",
    label: "Event poster",
    href: "/generate/posters",
    prompt:
      "A modern minimalist poster for a weekend design workshop in a city loft. Clean typography, bold accent color.",
    description: "Visual poster concept",
  },
  {
    id: "blog-howto",
    label: "How-to blog outline",
    href: "/generate/blog",
    prompt:
      "How to build a personal content system that turns notes into posts in under an hour.",
    description: "Structured how-to outline",
  },
  {
    id: "caption-ig",
    label: "Instagram caption",
    href: "/generate/captions",
    prompt:
      "Caption for a behind-the-scenes photo of a creator editing content at a standing desk with morning light.",
    description: "Engaging IG caption + hashtags",
  },
];

export type OnboardingStep = {
  id: string;
  label: string;
  href: string;
  doneWhen: "hasGeneration" | "hasProject" | "always";
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "signup",
    label: "Create your account",
    href: "/dashboard",
    doneWhen: "always",
  },
  {
    id: "first-generation",
    label: "Generate your first piece of content",
    href: "/generate",
    doneWhen: "hasGeneration",
  },
  {
    id: "first-project",
    label: "Open or save a project in the builder",
    href: "/builder",
    doneWhen: "hasProject",
  },
];
