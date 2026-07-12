import { GeneratorLayout } from "@/components/generate/generator-layout";

export default function PhotosPage() {
  return (
    <GeneratorLayout
      title="Photo Generator"
      description="Generate photorealistic images. Upload a reference for similar composition."
      generationType="photo"
      apiEndpoint="/api/ai/generate/photo"
      outputType="image"
      contextFields={[
        {
          key: "style",
          label: "Style",
          type: "select",
          options: [
            "photorealistic",
            "cinematic",
            "portrait",
            "landscape",
            "product",
          ],
        },
        {
          key: "negativePrompt",
          label: "Avoid",
          type: "text",
          placeholder: "e.g. blurry, low quality",
        },
      ]}
    />
  );
}
