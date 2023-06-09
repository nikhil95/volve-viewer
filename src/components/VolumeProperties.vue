<script lang="ts">
import { computed, defineComponent, ref, watch } from '@vue/composition-api';
import { useCurrentImage } from '../composables/useCurrentImage';
import { useViewConfigStore } from '../store/view-configs';
import { CVRConfig } from '../types/views';

const TARGET_VIEW_ID = '3D';

const LIGHTING_MODELS = {
  standard: 'Standard',
  hybrid: 'Hybrid',
  lao: 'Ambient Occlusion',
};

export default defineComponent({
  name: 'VolumeRendering',
  setup() {
    const viewConfigStore = useViewConfigStore();

    const { currentImageID } = useCurrentImage();

    const volumeColorConfig = viewConfigStore.getComputedVolumeColorConfig(
      TARGET_VIEW_ID,
      currentImageID
    );

    watch(volumeColorConfig, () => {
      const imageID = currentImageID.value;
      if (imageID && !volumeColorConfig.value) {
        // creates a default color config
        viewConfigStore.updateVolumeColorConfig(TARGET_VIEW_ID, imageID, {});
      }
    });

    // --- CVR --- //

    const cvrParams = computed(() => volumeColorConfig.value?.cvr);

    const setCVRParam = (key: keyof CVRConfig, value: any) => {
      if (!currentImageID.value) return;
      viewConfigStore.updateVolumeCVRParameters(
        TARGET_VIEW_ID,
        currentImageID.value,
        {
          [key]: value,
        }
      );
    };

    const laoEnabled = computed(
      () => !!cvrParams.value?.useLocalAmbientOcclusion
    );
    const vsbEnabled = computed(
      () => !!cvrParams.value?.useVolumetricScatteringBlending
    );

    const lightingModel = ref(2); // LAO is default
    const selectLightingMode = (buttonIdx: number) => {
      if (buttonIdx === 0) {
        setCVRParam('useVolumetricScatteringBlending', false);
        setCVRParam('useLocalAmbientOcclusion', false);
      } else if (buttonIdx === 1) {
        setCVRParam('useVolumetricScatteringBlending', true);
        setCVRParam('useLocalAmbientOcclusion', false);
      } else if (buttonIdx === 2) {
        setCVRParam('useVolumetricScatteringBlending', false);
        setCVRParam('useLocalAmbientOcclusion', true);
      }
    };

    return {
      cvrParams,
      laoEnabled,
      vsbEnabled,
      setCVRParam,
      LIGHTING_MODELS,
      selectLightingMode,
      lightingModel,
    };
  },
});
</script>

<template>
  <div class="mx-2">
    <div class="mt-4" ref="editorContainerRef">
      <div ref="pwfEditorRef" />
    </div>
    <div v-if="!!cvrParams">
      <v-slider
        label="Ambient"
        min="0"
        max="1"
        step="0.1"
        dense
        hide-details
        thumb-label
        :value="cvrParams.ambient"
        @change="setCVRParam('ambient', $event)"
      />
      <v-slider
        label="Diffuse"
        min="0"
        max="2"
        step="0.1"
        dense
        hide-details
        thumb-label
        :value="cvrParams.diffuse"
        @change="setCVRParam('diffuse', $event)"
      />
      <v-switch
        label="Light follows camera"
        dense
        hide-details
        :input-value="cvrParams.lightFollowsCamera"
        @change="setCVRParam('lightFollowsCamera', !!$event)"
      />
      <v-divider class="my-8" />

      <v-row class="my-4">
        <v-btn-toggle
          v-model="lightingModel"
          @change="selectLightingMode"
          mandatory
        >
          <v-btn v-for="model in Object.values(LIGHTING_MODELS)" :key="model">
            {{ model }}
          </v-btn>
        </v-btn-toggle>
      </v-row>

      <v-slider
        label="Scatter Blending"
        min="0"
        max="1"
        step="0.05"
        dense
        hide-details
        thumb-label
        v-if="vsbEnabled"
        :value="cvrParams.volumetricScatteringBlending"
        @change="setCVRParam('volumetricScatteringBlending', $event)"
      />
      <v-slider
        label="LAO Kernel Size"
        min="2"
        max="10"
        step="1"
        dense
        hide-details
        thumb-label
        v-if="laoEnabled"
        :value="cvrParams.laoKernelSize"
        @change="setCVRParam('laoKernelSize', $event)"
      />
      <v-slider
        label="LAO Kernel Radius"
        :min="cvrParams.laoKernelSize * 2"
        :max="cvrParams.laoKernelSize * 2 + 10"
        step="1"
        dense
        hide-details
        thumb-label
        v-if="laoEnabled"
        :value="cvrParams.laoKernelRadius"
        @change="setCVRParam('laoKernelRadius', $event)"
      />
    </div>
  </div>
</template>
