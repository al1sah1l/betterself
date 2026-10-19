<script setup lang="ts">
import GoalDetailContent from "./GoalDetailContent.vue";
import ObservedResults from "./ObservedResults.vue";

defineProps<{
  session: string;
  goal: string;
}>();
</script>

<template>
  <GoalDetailContent
    :key="`detail-${session}-${goal}`"
    :session="session"
    :goal="goal"
  />

  <ObservedResults
    :key="`results-${session}-${goal}`"
    :session="session"
    :goal="goal"
  />
</template>
