<script lang="ts">
import { computed, defineComponent } from '@vue/composition-api';
import { useCurrentImage } from '../composables/useCurrentImage';
import VolumeProperties from './VolumeProperties.vue';
import VolumeRendering from './VolumeRendering.vue';
import VolumePresets from './VolumePresets.vue';

export default defineComponent({
  components: { VolumeRendering, VolumePresets, VolumeProperties },
  setup() {
    const { currentImageData } = useCurrentImage();
    const hasCurrentImage = computed(() => !!currentImageData.value);
    return {
      hasCurrentImage,
    };
  },
});
</script>

<template>
  <div class="overflow-y-auto mx-2 fill-height">
    <template v-if="hasCurrentImage">
      <volume-rendering />
      <v-expansion-panels multiple accordion :value="[1]">
        <v-expansion-panel>
          <v-expansion-panel-header>
            <v-icon class="flex-grow-0 mr-4">mdi-palette</v-icon>
            Color Presets
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <volume-presets />
          </v-expansion-panel-content>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-header>
            <v-icon class="flex-grow-0 mr-4">mdi-cube-scan</v-icon>
            Cinematic Rendering
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <volume-properties />
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
    <template v-else>
      <div class="text-center pt-12 text-subtitle-1">No image selected</div>
    </template>
  </div>
</template>
