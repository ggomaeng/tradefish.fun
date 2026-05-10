// scripts/keys/generate-owner.ts
// One-shot: generate the owner-identity keypair, write to ~/Documents/tradefish-owner-wallet.json
// (NOT in repo — perms 0600), print pubkey for RUNBOOK §1.

import { Keypair } from "@solana/web3.js";
import { writeFileSync, chmodSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OUT = join(homedir(), "Documents", "tradefish-owner-wallet.json");

if (existsSync(OUT)) {
  console.error(`ERROR: ${OUT} already exists. Refusing to overwrite. Delete it manually if you really want a new one.`);
  process.exit(1);
}

const kp = Keypair.generate();
writeFileSync(OUT, JSON.stringify(Array.from(kp.secretKey)));
chmodSync(OUT, 0o600);

console.log(JSON.stringify({
  role: "owner-identity",
  pubkey: kp.publicKey.toBase58(),
  path: OUT,
  next_step: "Add this pubkey to .loop-state/RUNBOOK.md §1 (owner wallet pubkey). Optionally fund with a small amount of mainnet SOL (~0.001) for tx fees when claiming agents."
}, null, 2));
