<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  text: string;
}>();

const parts = computed(() =>
  props.text
    .split(/(https?:\/\/[^\s<>"']+)/gi)
    .filter(Boolean)
    .map((text) => ({
      text,
      isLink: /^https?:\/\//i.test(text),
    })),
);
</script>

<template>
  <span class="evidence-text">
    <template
      v-for="(part, index) in parts"
      :key="index"
    >
      <a
        v-if="part.isLink"
        :href="part.text"
        target="_blank"
        rel="noopener noreferrer"
      >{{ part.text }}</a>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<style scoped>
.evidence-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

a:hover {
  color: var(--accent-hover);
}

a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}
</style>
