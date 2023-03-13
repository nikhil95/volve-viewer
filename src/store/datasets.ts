import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { vtkObject } from '@kitware/vtk.js/interfaces';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import { defineStore } from 'pinia';
import { computed, ref } from '@vue/composition-api';
import { useDICOMStore } from './datasets-dicom';
import { useImageStore } from './datasets-images';
import { useModelStore } from './datasets-models';
import { extractArchivesRecursively, retypeFile, FILE_READERS } from '../io';
import { useFileStore } from './datasets-files';
import { DataSet, StateFile, DataSetType } from '../io/state-file/schema';
import { useMessageStore } from './messages';

export const DataType = {
  Image: 'Image',
  Model: 'Model',
};

const makeFileSuccessStatus = (
  file: File,
  type: 'model' | 'image',
  dataID: string
) =>
  ({
    type: 'file',
    loaded: true,
    filename: file.name,
    dataID,
    dataType: type,
  } as const);

export type FileLoadSuccess = ReturnType<typeof makeFileSuccessStatus>;

export const makeFileFailureStatus = (file: File | string, reason: string) =>
  ({
    type: 'file',
    loaded: false,
    filename: typeof file === 'string' ? file : file.name,
    error: new Error(reason),
  } as const);

export type FileLoadFailure = ReturnType<typeof makeFileFailureStatus>;

const makeDICOMSuccessStatus = (volumeKey: string) =>
  ({
    type: 'dicom',
    loaded: true,
    dataID: volumeKey,
    dataType: 'dicom',
  } as const);

export type DICOMLoadSuccess = ReturnType<typeof makeDICOMSuccessStatus>;

const makeDICOMFailureStatus = (error: Error) =>
  ({
    type: 'dicom',
    loaded: false,
    error,
  } as const);

export type DICOMLoadFailure = ReturnType<typeof makeDICOMFailureStatus>;

export type FileLoadResult = FileLoadSuccess | FileLoadFailure;
export type DICOMLoadResult = DICOMLoadSuccess | DICOMLoadFailure;
export type LoadResult = FileLoadResult | DICOMLoadResult;

export const makeDICOMSelection = (volumeKey: string) =>
  ({
    type: 'dicom',
    volumeKey,
  } as const);

export type DICOMSelection = ReturnType<typeof makeDICOMSelection>;

export const makeImageSelection = (imageID: string) =>
  ({
    type: 'image',
    dataID: imageID,
  } as const);

export type ImageSelection = ReturnType<typeof makeImageSelection>;

export type DataSelection = DICOMSelection | ImageSelection;

export function selectionEquals(s1: DataSelection, s2: DataSelection) {
  if (s1.type === 'dicom' && s2.type === 'dicom') {
    return s1.volumeKey === s2.volumeKey;
  }
  if (s1.type === 'image' && s2.type === 'image') {
    return s1.dataID === s2.dataID;
  }
  return false;
}

export function convertSuccessResultToDataSelection(
  result: FileLoadSuccess | DICOMLoadSuccess
) {
  if (result.type === 'dicom') {
    return makeDICOMSelection(result.dataID);
  }
  if (result.type === 'file') {
    if (result.dataType === 'image') {
      return makeImageSelection(result.dataID);
    }
  }
  return null;
}

export const useDatasetStore = defineStore('dataset', () => {
  type _This = ReturnType<typeof useDatasetStore>;

  const imageStore = useImageStore();
  const modelStore = useModelStore();
  const dicomStore = useDICOMStore();
  const fileStore = useFileStore();

  // --- state --- //

  const primarySelection = ref<DataSelection | null>(null);

  // --- getters --- //

  const primaryDataset = computed<vtkImageData | null>(() => {
    const sel = primarySelection.value;
    const { dataIndex } = imageStore;
    const { volumeToImageID } = dicomStore;

    if (sel?.type === 'dicom') {
      const id = volumeToImageID[sel.volumeKey];
      return dataIndex[id] || null;
    }
    if (sel?.type === 'image') {
      return dataIndex[sel.dataID] || null;
    }
    return null;
  });

  const allDataIDs = computed(() => {
    return [...imageStore.idList, ...modelStore.idList];
  });

  function getDataProxyByID<T extends vtkObject>(this: _This, id: string) {
    return this.$proxies.getData<T>(id);
  }

  // --- actions --- //

  async function setPrimarySelection(sel: DataSelection | null) {
    primarySelection.value = sel;

    if (sel === null) {
      return;
    }

    // if selection is dicom, call buildVolume
    if (sel.type === 'dicom') {
      try {
        // trigger dicom dataset building
        await dicomStore.buildVolume(sel.volumeKey);
      } catch (err) {
        if (err instanceof Error) {
          const messageStore = useMessageStore();
          messageStore.addError('Failed to build volume(s)', {
            details: `${err}. More details can be found in the developer's console.`,
          });
        }
      }
    }
  }

  async function loadFiles(files: File[]): Promise<LoadResult[]> {
    const typedFiles = await Promise.all(files.map((f) => retypeFile(f)));

    // process archives
    const fileEntries = await extractArchivesRecursively(typedFiles);
    const allFiles = fileEntries.map((entry) => entry.file);

    const dicoms = allFiles.filter(({ type }) => type === 'dcm');
    const otherFiles = allFiles.filter(({ type }) => type !== 'dcm');

    const dicomStatus = dicomStore
      .importFiles(dicoms)
      .then((volumeKeys) =>
        volumeKeys.map((volKey) => makeDICOMSuccessStatus(volKey.volumeKey))
      )
      .catch((err) => [makeDICOMFailureStatus(err)]);

    const otherStatuses = Promise.all([
      ...otherFiles.map(async (file) => {
        const reader = FILE_READERS.get(file.type);
        if (reader) {
          try {
            const dataObj = await reader(file);
            if (dataObj.isA('vtkImageData')) {
              const id = imageStore.addVTKImageData(
                file.name,
                dataObj as vtkImageData
              );
              fileStore.add(id, [file]);

              return makeFileSuccessStatus(file, 'image', id);
            }
            if (dataObj.isA('vtkPolyData')) {
              const id = modelStore.addVTKPolyData(
                file.name,
                dataObj as vtkPolyData
              );
              fileStore.add(id, [file]);

              return makeFileSuccessStatus(file, 'model', id);
            }
            return makeFileFailureStatus(
              file,
              `${file.name} did not result in a valid dataset`
            );
          } catch (e) {
            return makeFileFailureStatus(
              file,
              `Reading ${file.name} gave an error: ${e}`
            );
          }
        }
        // indicate an error has occurred
        return makeFileFailureStatus(file, `No reader for ${file.name}`);
      }),
    ]);

    const statuses = [...(await dicomStatus), ...(await otherStatuses)];
    return statuses;
  }

  async function serialize(stateFile: StateFile) {
    await dicomStore.serialize(stateFile);
    await imageStore.serialize(stateFile);

    if (primarySelection.value !== null) {
      let id = null;
      if (primarySelection.value.type === 'dicom') {
        id = primarySelection.value.volumeKey;
      } else {
        id = primarySelection.value.dataID;
      }

      const { manifest } = stateFile;
      manifest.primarySelection = id;
    }
  }

  async function deserialize(dataSet: DataSet, files: File[]) {
    // dicom
    if (dataSet.type === DataSetType.DICOM) {
      return dicomStore
        .deserialize(dataSet, files)
        .then((volumeKey) => makeDICOMSuccessStatus(volumeKey))
        .catch((err) => makeDICOMFailureStatus(err));
    }

    // image
    if (files.length !== 1) {
      throw new Error('Invalid state file.');
    }
    const file = files[0];

    return imageStore
      .deserialize(dataSet, file)
      .then((dataID) => makeFileSuccessStatus(file, 'image', dataID))
      .catch((err) =>
        makeFileFailureStatus(
          file.name,
          `Reading ${file.name} gave an error: ${err}`
        )
      );
  }

  // --- watch for deletion --- //

  imageStore.$onAction(({ name, args, after }) => {
    if (name !== 'deleteData') {
      return;
    }
    after(() => {
      const [id] = args;
      const sel = primarySelection.value;
      if (sel?.type === 'image' && sel.dataID === id) {
        primarySelection.value = null;
      }
      // remove file store entry
      fileStore.remove(id);
    });
  });

  dicomStore.$onAction(({ name, args, after }) => {
    if (name !== 'deleteVolume') {
      return;
    }
    after(() => {
      const [volumeKey] = args;
      const sel = primarySelection.value;
      if (sel?.type === 'dicom' && volumeKey === sel.volumeKey) {
        primarySelection.value = null;
      }

      // remove file store entry
      fileStore.remove(volumeKey);
    });
  });

  return {
    primarySelection,
    primaryDataset,
    allDataIDs,
    getDataProxyByID,
    setPrimarySelection,
    loadFiles,
    serialize,
    deserialize,
  };
});
