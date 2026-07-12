import { GeneratorLayout } from "@/components/generate/generator-layout";

export default function PostersPage() {
  return (
    <GeneratorLayout
      title="Poster Generator"
      description="Create stunning poster designs with AI. Upload a reference image for similar style."
      generationType="poster"
      apiEndpoint="/api/ai/generate/poster"
      outputType="image"
      contextFields={[
        {
          key: "style",
          label: "Style",
          type: "select",
          options: [
            "modern minimalist",
            "bold graphic",
            "vintage",
            "corporate",
            "artistic",
          ],
        },
        {
          key: "aspectRatio",
          label: "Aspect Ratio",
          type: "select",
          options: ["1:1", "16:9", "9:16", "4:3"],
        },
        {
          key: "audience",
          label: "Audience",
          type: "text",
          placeholder: "e.g. tech professionals",
        },
      ]}
    />
  );
}
