// scripts/launch-verify/types.ts

export type CheckStatus = "pass" | "fail" | "warn";

export type CheckResult = {
  name: string;
  status: CheckStatus;
  /** Convenience boolean for legacy callers: true iff status === "pass". */
  pass: boolean;
  detail: string;
  duration_ms: number;
};

export type CheckOutcome = {
  status: CheckStatus;
  detail: string;
};

export type CheckContext = {
  target: string;
  /** When true, network-dependent checks should short-circuit with `warn`. */
  skipNetwork: boolean;
};

export type Check = {
  name: string;
  /**
   * Receives a context object. Network-dependent checks should consult
   * `ctx.skipNetwork` and return `warn` when set, so offline runs don't fail.
   */
  run: (ctx: CheckContext) => Promise<CheckOutcome>;
};

export type VerifyReport = {
  target: string;
  ran_at: string;
  /** 0 if no `fail` results (warns allowed); 1 otherwise. */
  exit_code: 0 | 1;
  results: CheckResult[];
};
