
import { api } from "./api";

export type GoalSummary = {
  goal: string;
  outcome: string;
  timeline: string;
  successDefinition: string;
};

export type CompletionSummary = {
  occurrence: string;
};

export type CommitmentSummary = {
  commitment: string;
  description: string;
  recurring: boolean;
  schedule: string;
  active: boolean;
  completions: CompletionSummary[];
};

export type GoalOverview = GoalSummary & {
  commitments: CommitmentSummary[];
};

export async function loadGoalOverviews(
  session: string,
): Promise<GoalOverview[]> {
  const response = await api<{ goals: GoalSummary[] }>(
    "/dashboard/goals",
    { session },
  );

  return Promise.all(
    response.goals.map(async (goal) => {
      const result = await api<{
        detail: { commitments: CommitmentSummary[] };
      }>("/dashboard/goal", {
        session,
        goal: goal.goal,
      });

      return {
        ...goal,
        commitments: result.detail.commitments ?? [],
      };
    }),
  );
}

export function completedCount(
  commitments: CommitmentSummary[],
): number {
  return commitments.reduce(
    (sum, commitment) =>
      sum + commitment.completions.length,
    0,
  );
}
