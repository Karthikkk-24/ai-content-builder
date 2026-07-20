const GENERATION_ROUTES: Record<string, string> = {
  tweet: "/generate/tweets",
  blog: "/generate/blog",
  caption: "/generate/captions",
  poster: "/generate/posters",
  photo: "/generate/photos",
  prompt_upgrade: "/generate/prompt-upgrade",
};

export function hrefForGenerationType(type: string): string {
  return GENERATION_ROUTES[type] ?? "/builder";
}
