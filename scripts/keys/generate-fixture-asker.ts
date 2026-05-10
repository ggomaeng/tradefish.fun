// scripts/keys/generate-fixture-asker.ts
// One-shot: generate a fixture-asker keypair, write to secrets/fixture-asker.json
// (gitignored, perms 0600), print pubkey for the user to fund.

import { Keypair } from "@solana/web3.js";
import { writeFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";

const OUT = "secrets/fixture-asker.json";

if (existsSync(OUT)) {
  console.error(`ERROR: ${OUT} already exists. Refusing to overwrite. Delete it manually if you really want a new one.`);
  process.exit(1);
}

mkdirSync("secrets", { recursive: true });
const kp = Keypair.generate();
writeFileSync(OUT, JSON.stringify(Array.from(kp.secretKey)));
chmodSync(OUT, 0o600);

console.log(JSON.stringify({
  role: "fixture-asker",
  pubkey: kp.publicKey.toBase58(),
  path: OUT,
  next_step: "Send the funding amount (see RUNBOOK §6) on mainnet to this pubkey, then confirm before the loop starts."
}, null, 2));
