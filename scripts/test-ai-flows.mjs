/**
 * Sanity test script for AI flows.
 * Run: node --experimental-strip-types scripts/test-ai-flows.mjs
 */
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#")) process.env[k.trim()] = v.join("=").trim();
}

const { generateTextWithFallback, generateImage } = await import(
  "../src/lib/ai/router.ts"
);

const tests = [
  {
    name: "prompt-upgrade text",
    run: () =>
      generateTextWithFallback({
        system: "You improve prompts. Return only the improved prompt.",
        prompt: "Write a tweet about GitHub repos",
      }),
  },
  {
    name: "tweet generation",
    run: () =>
      generateTextWithFallback({
        system: "You write tweets under 280 chars. Return only the tweet.",
        prompt: "A tool that analyzes GitHub repos instantly",
      }),
  },
  {
    name: "poster prompt expansion",
    run: () =>
      generateTextWithFallback({
        system: "Expand this into a detailed image generation prompt.",
        prompt: "Minimal tech poster for mindrepo.online",
      }),
  },
  {
    name: "photo prompt expansion",
    run: () =>
      generateTextWithFallback({
        system: "Expand this into a detailed photo generation prompt.",
        prompt: "Developer workspace with laptop showing code",
      }),
  },
  {
    name: "image generation (pollinations)",
    run: () => generateImage({ prompt: "minimal black and white logo", width: 512, height: 512 }),
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = await test.run();
    const preview =
      "text" in result
        ? result.text.slice(0, 80)
        : result.imageUrl.slice(0, 60);
    console.log(`✓ ${test.name}: ${preview}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${test.name}: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
