// scripts/launch-verify/types.ts

export type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
  duration_ms: number;
};

export type Check = {
  name: string;
  run: (target: string) => Promise<Omit<CheckResult, "name" | "duration_ms">>;
};

export type VerifyReport = {
  target: string;
  ran_at: string;
  exit_code: 0 | 1;
  results: CheckResult[];
};
