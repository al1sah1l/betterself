
<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  api,
  ApiError,
  uploadProofImage,
} from "./api";

const props = defineProps<{
  session: string;
  goal: string;
  commitment: string;
  existingOccurrence?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

type SelectedImage = {
  id: number;
  file: File;
  preview: string;
};

const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const occurrence = ref("");
const evidence = ref("");
const images = ref<SelectedImage[]>([]);

const loading = ref(false);
const error = ref("");
const success = ref("");

const imageInput = ref<HTMLInputElement | null>(null);
let nextImageId = 0;

function removeImage(id: number) {
  const selected = images.value.find(
    (item) => item.id === id,
  );

  if (selected) {
    URL.revokeObjectURL(selected.preview);
  }

  images.value = images.value.filter(
    (item) => item.id !== id,
  );

  // Allow reselecting a file previously removed.
  if (imageInput.value) {
    imageInput.value.value = "";
  }
}

function clearImages() {
  for (const item of images.value) {
    URL.revokeObjectURL(item.preview);
  }

  images.value = [];

  if (imageInput.value) {
    imageInput.value.value = "";
  }
}

function chooseImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);

  error.value = "";

  for (const file of files) {
    if (images.value.length >= MAX_IMAGES) {
      error.value =
        `You can attach up to ${MAX_IMAGES} images per proof.`;
      break;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      error.value =
        "Only PNG, JPEG, WebP and GIF images are supported.";
      continue;
    }

    if (
      file.size === 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      error.value =
        "Each image must be between 1 byte and 5 MB.";
      continue;
    }

    // Avoid adding the same file twice accidentally.
    const duplicate = images.value.some(
      (item) =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified,
    );

    if (duplicate) continue;

    images.value.push({
      id: nextImageId++,
      file,
      preview: URL.createObjectURL(file),
    });
  }

  // Reset file input so more images can be selected later.
  input.value = "";
}

async function submitProof() {
  if (loading.value || props.disabled) {
    return;
  }

  error.value = "";
  success.value = "";

  const occurrenceValue =
    props.existingOccurrence ?? occurrence.value;

  const date = new Date(occurrenceValue);

  const items = evidence.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    !occurrenceValue ||
    !Number.isFinite(date.getTime())
  ) {
    error.value =
      "Choose when you completed this commitment.";
    return;
  }

  if (
    items.length === 0 &&
    images.value.length === 0
  ) {
    error.value =
      "Add text evidence or attach at least one image.";
    return;
  }

  loading.value = true;

  try {
    // Upload every image, then submit ONE proof.
    for (const item of images.value) {
      const reference = await uploadProofImage(
        props.session,
        item.file,
      );

      items.push(reference);
    }

    await api<{ proof: string }>(
      "/proofs/submit",
      {
        session: props.session,
        goal: props.goal,
        commitment: props.commitment,
        occurrence: date.toISOString(),
        evidence: items,
      },
    );

    success.value =
      "Proof submitted successfully. Peer verification is a separate step.";

    evidence.value = "";
    clearImages();

    emit("submitted");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You do not have permission to submit this proof."
            : cause.code === "NOT_FOUND"
              ? "The goal or commitment could not be found."
              : cause.code === "CONFLICT"
                ? "This occurrence already has a proof or cannot be completed again."
                : cause.code === "INVALID_REQUEST"
                  ? "Please check your completion time and evidence."
                  : "Could not submit proof. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not submit proof. Please try again.";
  } finally {
    loading.value = false;
  }
}

onUnmounted(clearImages);
</script>

<template>
  <form @submit.prevent="submitProof">
    <fieldset :disabled="loading || props.disabled">
      <legend>Submit proof</legend>

      <p
        v-if="props.existingOccurrence"
        class="muted"
      >
        Completed at:
        {{ new Date(props.existingOccurrence).toLocaleString() }}
      </p>

      <template v-else>
        <label :for="`occurrence-${props.commitment}`">
          Completed at (your local time)
        </label>

        <input
          :id="`occurrence-${props.commitment}`"
          v-model="occurrence"
          type="datetime-local"
          required
        />
      </template>

      <label :for="`evidence-${props.commitment}`">
        Evidence text or links (optional)
      </label>

      <textarea
        :id="`evidence-${props.commitment}`"
        v-model="evidence"
        rows="3"
        placeholder="Describe what you did or paste a link."
      />

      <label :for="`images-${props.commitment}`">
        Proof images (optional)
      </label>

      <input
        :id="`images-${props.commitment}`"
        ref="imageInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        :disabled="
          loading ||
          props.disabled ||
          images.length >= MAX_IMAGES
        "
        @change="chooseImages"
      />

      <p class="upload-hint">
        {{ images.length }} / {{ MAX_IMAGES }} images selected.
        Maximum 5 MB each.
      </p>

      <div
        v-if="images.length"
        class="preview-grid"
        aria-label="Selected images"
      >
        <div
          v-for="item in images"
          :key="item.id"
          class="preview-tile"
        >
          <img
            :src="item.preview"
            :alt="`Selected image: ${item.file.name}`"
          />

          <button
            class="remove-image"
            type="button"
            :aria-label="`Remove ${item.file.name}`"
            :disabled="loading"
            @click="removeImage(item.id)"
          >
            ×
          </button>
        </div>
      </div>

      <button
        class="primary submit-button"
        type="submit"
        :disabled="loading || props.disabled"
      >
        {{
          loading
            ? `Uploading and submitting ${images.length} image(s)...`
            : props.disabled
              ? "Proof already submitted"
              : "Submit proof"
        }}
      </button>
    </fieldset>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" class="success" role="status">
      {{ success }}
    </p>
  </form>
</template>

<style scoped>
textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.upload-hint {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.preview-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(85px, 1fr));
  gap: 10px;
  margin: 6px 0 12px;
}

.preview-tile {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--background);
}

.preview-tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(35, 25, 50, 0.85);
  color: white;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.submit-button {
  width: fit-content;
}

.success {
  color: #514080;
  font-weight: 600;
  line-height: 1.5;
}
</style>
