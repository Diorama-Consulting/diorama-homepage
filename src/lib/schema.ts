import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});