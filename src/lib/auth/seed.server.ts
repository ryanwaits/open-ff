import { hashPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { LOCAL_SEED } from "./local-seed";

/** Insert the local test account if the user table is empty of this email. */
export async function seedLocalAccount(sql: Sql): Promise<void> {
  const existing = await sql`select id from "user" where email = ${LOCAL_SEED.email}`;
  if (existing[0]) return;
  const password = await hashPassword(LOCAL_SEED.password);
  const now = new Date().toISOString();
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (
      ${LOCAL_SEED.userId}, ${LOCAL_SEED.name}, ${LOCAL_SEED.email},
      ${true}, ${now}, ${now}
    )
  `;
  await sql`
    insert into account (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) values (
      ${"acct_ryan"}, ${LOCAL_SEED.userId}, ${"credential"},
      ${LOCAL_SEED.userId}, ${password}, ${now}, ${now}
    )
  `;
}
