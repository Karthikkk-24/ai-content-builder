import { eq, count, desc, gte, and } from "drizzle-orm";
import { cacheGet, cacheSet, CACHE_TTL, userCacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { contentProjects, generations } from "@/lib/db/schema";

export type DashboardStats = {
  totalGenerations: number;
  totalProjects: number;
  weekGenerations: number;
  recent: Array<{
    id: string;
    type: string;
    inputPrompt: string;
    createdAt: Date;
  }>;
};

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const keys = userCacheKeys(userId);
  const cached = await cacheGet<DashboardStats>(keys.dashboard);
  if (cached) return cached;

  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [genCount, projectCount, weekCount, recent] = await Promise.all([
      db
        .select({ count: count() })
        .from(generations)
        .where(eq(generations.userId, userId)),
      db
        .select({ count: count() })
        .from(contentProjects)
        .where(eq(contentProjects.userId, userId)),
      db
        .select({ count: count() })
        .from(generations)
        .where(
          and(
            eq(generations.userId, userId),
            gte(generations.createdAt, weekAgo)
          )
        ),
      db
        .select({
          id: generations.id,
          type: generations.type,
          inputPrompt: generations.inputPrompt,
          createdAt: generations.createdAt,
        })
        .from(generations)
        .where(eq(generations.userId, userId))
        .orderBy(desc(generations.createdAt))
        .limit(5),
    ]);

    const stats: DashboardStats = {
      totalGenerations: genCount[0]?.count ?? 0,
      totalProjects: projectCount[0]?.count ?? 0,
      weekGenerations: weekCount[0]?.count ?? 0,
      recent,
    };

    await cacheSet(keys.dashboard, stats, CACHE_TTL.DASHBOARD_STATS);
    return stats;
  } catch {
    return {
      totalGenerations: 0,
      totalProjects: 0,
      weekGenerations: 0,
      recent: [],
    };
  }
}

export async function getCachedGenerations(userId: string, limit = 20) {
  const keys = userCacheKeys(userId);
  const cacheKey = `${keys.generations}:${limit}`;
  const cached = await cacheGet<Awaited<ReturnType<typeof fetchGenerations>>>(
    cacheKey
  );
  if (cached) return cached;

  const items = await fetchGenerations(userId, limit);
  await cacheSet(cacheKey, items, CACHE_TTL.GENERATIONS);
  return items;
}

async function fetchGenerations(userId: string, limit: number) {
  try {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
