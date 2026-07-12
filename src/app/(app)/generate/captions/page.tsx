import { GeneratorLayout } from "@/components/generate/generator-layout";

export default function CaptionsPage() {
  return (
    <GeneratorLayout
      title="Social Captions"
      description="Create engaging captions for Instagram, LinkedIn, and more."
      generationType="caption"
      apiEndpoint="/api/ai/generate/tweet"
      outputType="text"
      showReferenceImage={true}
      contextFields={[
        {
          key: "platform",
          label: "Platform",
          type: "select",
          options: ["Instagram", "LinkedIn", "Facebook", "TikTok"],
        },
        {
          key: "tone",
          label: "Tone",
          type: "select",
          options: ["professional", "casual", "playful", "inspirational"],
        },
      ]}
    />
  );
}
