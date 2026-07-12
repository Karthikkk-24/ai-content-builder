import { GeneratorLayout } from "@/components/generate/generator-layout";

export default function TweetsPage() {
  return (
    <GeneratorLayout
      title="Tweet Generator"
      description="Create engaging tweets and threads for Twitter/X."
      generationType="tweet"
      apiEndpoint="/api/ai/generate/tweet"
      outputType="text"
      showReferenceImage={false}
      charLimit={280}
      contextFields={[
        {
          key: "tone",
          label: "Tone",
          type: "select",
          options: ["professional", "casual", "witty", "inspirational"],
        },
        {
          key: "audience",
          label: "Audience",
          type: "text",
          placeholder: "e.g. developers, marketers",
        },
        {
          key: "threadMode",
          label: "Format",
          type: "select",
          options: ["single", "thread"],
        },
      ]}
    />
  );
}
