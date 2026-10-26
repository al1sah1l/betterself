
<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  api,
  ApiError,
  uploadProofImage,
} from "./api";

const props = defineProps<{
  session: string;
  proof: string;
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

const evidence = ref("");
const images = ref<SelectedImage[]>([]);

const loading = ref(false);
const submitted = ref(false);
const error = ref("");

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

  input.value = "";
}

async function resubmit() {
  if (loading.value || submitted.value) {
    return;
  }

  error.value = "";

  const items = evidence.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    items.length === 0 &&
    images.value.length === 0
  ) {
    error.value =
      "Add text evidence or at least one image.";
    return;
  }

  loading.value = true;

  try {
    for (const item of images.value) {
      const reference = await uploadProofImage(
        props.session,
        item.file,
      );

      items.push(reference);
    }

    await api<{ proof: string }>(
      "/proofs/resubmit",
      {
        session: props.session,
        previousProof: props.proof,
        evidence: items,
      },
    );

    submitted.value = true;
    evidence.value = "";
    clearImages();

    emit("submitted");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign in again."
          : cause.code === "FORBIDDEN"
            ? "Only the author can resubmit this proof."
            : cause.code === "NOT_FOUND"
              ? "The proof or commitment no longer exists."
              : cause.code === "CONFLICT"
                ? "This proof is no longer eligible for resubmission."
                : cause.code === "INVALID_REQUEST"
                  ? "Please check your evidence."
                  : "Could not submit new evidence."
        : cause instanceof Error
          ? cause.message
          : "Could not submit new evidence.";
  } finally {
    loading.value = false;
  }
}

onUnmounted(clearImages);
</script>

<template>
  <details class="resubmission">
    <summary>Submit new evidence</summary>

    <p class="muted explanation">
      Add clearer evidence for the same completion.
      Previous attempts and peer reviews remain in
      the history.
    </p>

    <form @submit.prevent="resubmit">
      <fieldset :disabled="loading || submitted">
        <label :for="`resubmit-evidence-${props.proof}`">
          New evidence text or links (optional)
        </label>

        <textarea
          :id="`resubmit-evidence-${props.proof}`"
          v-model="evidence"
          rows="4"
          placeholder="Describe your new evidence."
        />

        <label :for="`resubmit-images-${props.proof}`">
          New proof images (optional)
        </label>

        <input
          :id="`resubmit-images-${props.proof}`"
          ref="imageInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          :disabled="
            loading ||
            submitted ||
            images.length >= MAX_IMAGES
          "
          @change="chooseImages"
        />

        <p class="upload-hint">
          {{ images.length }} / {{ MAX_IMAGES }}
          images selected. Maximum 5 MB each.
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
              type="button"
              class="remove-image"
              :disabled="loading"
              :aria-label="`Remove ${item.file.name}`"
              @click="removeImage(item.id)"
            >
              ×
            </button>
          </div>
        </div>

        <button
          class="primary"
          type="submit"
          :disabled="loading || submitted"
        >
          {{
            loading
              ? "Uploading and submitting..."
              : submitted
                ? "Evidence submitted"
                : "Submit new evidence"
          }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="submitted" class="muted" role="status">
      New evidence submitted successfully.
    </p>
  </details>
</template>

<style scoped>
.resubmission {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

summary {
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}

.explanation,
.upload-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

fieldset {
  min-width: 0;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font: inherit;
  resize: vertical;
}

.preview-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(85px, 1fr));
  gap: 10px;
  margin: 8px 0 12px;
}

.preview-tile {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
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
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 50%;
  background: rgba(35, 25, 50, 0.85);
  color: white;
  font-size: 20px;
  cursor: pointer;
}
</style>
