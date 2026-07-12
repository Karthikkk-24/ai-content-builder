import { GeneratorLayout } from "@/components/generate/generator-layout";

export default function BlogPage() {
  return (
    <GeneratorLayout
      title="Blog Outline"
      description="Generate structured blog post outlines with AI."
      generationType="blog"
      apiEndpoint="/api/ai/generate/tweet"
      outputType="text"
      showReferenceImage={false}
      contextFields={[
        {
          key: "tone",
          label: "Tone",
          type: "select",
          options: ["informative", "conversational", "technical", "storytelling"],
        },
        {
          key: "audience",
          label: "Audience",
          type: "text",
          placeholder: "e.g. beginners, experts",
        },
      ]}
    />
  );
}
