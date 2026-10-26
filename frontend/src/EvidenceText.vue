
<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";

import { getCurrentSession } from "./api";

const props = defineProps<{
  text: string;
}>();

const isImage = computed(() =>
  /^image:[0-9a-f]{24}$/.test(props.text),
);

const imageUrl = ref("");
const imageError = ref("");
const imageDialog = ref<HTMLDialogElement | null>(null);

let generation = 0;

const parts = computed(() =>
  props.text
    .split(/(https?:\/\/[^\s<>"']+)/gi)
    .filter(Boolean)
    .map((text) => ({
      text,
      isLink: /^https?:\/\//i.test(text),
    })),
);

async function loadImage() {
  const id = ++generation;

  imageDialog.value?.close();

  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }

  imageUrl.value = "";
  imageError.value = "";

  if (!isImage.value) return;

  const session = getCurrentSession();

  if (!session) {
    imageError.value = "Sign in to view image.";
    return;
  }

  try {
    const response = await fetch(
      "/api/images/view",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          evidence: props.text,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Image access denied.");
    }

    const blob = await response.blob();

    if (id !== generation) return;

    imageUrl.value = URL.createObjectURL(blob);
  } catch {
    if (id === generation) {
      imageError.value =
        "Image is unavailable or access is denied.";
    }
  }
}

function openImage() {
  if (imageUrl.value) {
    imageDialog.value?.showModal();
  }
}

function closeImage() {
  imageDialog.value?.close();
}

function closeOnBackdrop(event: MouseEvent) {
  if (event.target === imageDialog.value) {
    closeImage();
  }
}

onMounted(loadImage);

watch(
  () => props.text,
  loadImage,
);

onUnmounted(() => {
  generation++;

  imageDialog.value?.close();

  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
});
</script>

<template>
  <span
    v-if="isImage"
    class="image-evidence"
  >
    <button
      v-if="imageUrl"
      type="button"
      class="image-thumbnail"
      aria-label="Open proof image fullscreen"
      @click="openImage"
    >
      <img
        :src="imageUrl"
        alt="Submitted proof image"
        loading="lazy"
      />

      <span
        class="zoom-indicator"
        aria-hidden="true"
      >
        ⤢
      </span>
    </button>

    <span
      v-else-if="imageError"
      class="image-error"
    >
      {{ imageError }}
    </span>

    <span v-else class="image-loading">
      Loading image…
    </span>

    <dialog
      ref="imageDialog"
      class="image-dialog"
      aria-label="Full screen proof image"
      @click="closeOnBackdrop"
    >
      <button
        type="button"
        class="close-image"
        aria-label="Close image"
        @click="closeImage"
      >
        ×
      </button>

      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Full size submitted proof"
        class="full-image"
      />
    </dialog>
  </span>

  <span
    v-else
    class="evidence-text"
  >
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

      <template v-else>
        {{ part.text }}
      </template>
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

.image-evidence {
  display: inline-block;
  vertical-align: top;
}

.image-thumbnail {
  position: relative;
  display: block;
  width: 124px;
  height: 124px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
  cursor: zoom-in;
}

.image-thumbnail:hover {
  border-color: var(--accent);
}

.image-thumbnail:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.image-thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.image-thumbnail:hover img {
  transform: scale(1.06);
}

.zoom-indicator {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 7px;
  background: rgba(30, 20, 45, 0.75);
  color: white;
  font-size: 20px;
  line-height: 1;
}

.image-dialog {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0;
  padding: 52px 20px 20px;
  border: 0;
  background: rgba(18, 13, 30, 0.96);
  color: white;
  overflow: auto;
}

.image-dialog[open] {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-dialog::backdrop {
  background: rgba(18, 13, 30, 0.75);
}

.full-image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 80px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
}

.close-image {
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 1;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 30px;
  cursor: pointer;
}

.close-image:hover {
  background: rgba(255, 255, 255, 0.25);
}

.image-error {
  color: #a32939;
  font-size: 13px;
}

.image-loading {
  color: var(--muted);
  font-size: 13px;
}

/* Arrange multiple evidence items as wrapping tiles
   in the existing Goal Detail and Group Proofs lists. */
:global(.evidence-list) {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  padding-left: 0;
  list-style: none;
}

:global(.evidence-list > li) {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .image-thumbnail {
    width: 100px;
    height: 100px;
  }
}
</style>
