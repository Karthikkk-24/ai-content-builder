import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  /**
   * Rate-limit / plan tier. Default `free`. Assign via SQL or a future billing
   * webhook (`UPDATE users SET tier = 'pro' WHERE id = ...`). Not user-writable.
   */
  tier: text("tier").notNull().default("free"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentProjects = pgTable(
  "content_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    blocks: jsonb("blocks").notNull().default([]),
    // Optional link to the AI generation that produced this project.
    // set-null so deleting a generation doesn't kill user-edited projects.
    generationId: uuid("generation_id").references(() => generations.id, {
      onDelete: "set null",
    }),
    /** When true, the project is readable at /share/[id] without auth. */
    isPublic: boolean("is_public").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("content_projects_user_id_idx").on(table.userId),
    index("content_projects_generation_id_idx").on(table.generationId),
    index("content_projects_is_public_idx").on(table.isPublic),
  ]
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    inputPrompt: text("input_prompt").notNull(),
    outputContent: text("output_content").notNull(),
    referenceImageUrl: text("reference_image_url"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("generations_user_id_idx").on(table.userId)]
);

export const referenceImages = pgTable(
  "reference_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    fileName: text("file_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("reference_images_user_id_idx").on(table.userId)]
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultTone: text("default_tone"),
  defaultGenerationType: text("default_generation_type"),
  marketingOptOut: boolean("marketing_opt_out").notNull().default(false),
  customAvatarUrl: text("custom_avatar_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ContentBlock = {
  id: string;
  type: "heading" | "paragraph" | "image" | "divider" | "cta";
  content: string;
  level?: number;
  url?: string;
};
