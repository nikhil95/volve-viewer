import macro from '@kitware/vtk.js/macro';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import ImagePropertyConstants from '@kitware/vtk.js/Rendering/Core/ImageProperty/Constants';

import vtkIJKSliceRepresentationProxy from '../IJKSliceRepresentationProxy';

const { InterpolationType } = ImagePropertyConstants;

// ----------------------------------------------------------------------------
// vtkLabelMapSliceRepProxy methods
// ----------------------------------------------------------------------------

function vtkLabelMapSliceRepProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLabelMapSliceRepProxy');

  let labelMapSub = null;

  // needed for vtk.js >= 23.0.0
  model.property.setUseLookupTableScalarRange(true);
  model.property.setInterpolationType(InterpolationType.NEAREST);
  model.mapper.setRelativeCoincidentTopologyPolygonOffsetParameters(-2, -2);

  let cachedColorMap = null;

  function updateTransferFunctions(labelmap) {
    const colorMap = labelmap.getColorMap();
    if (colorMap === cachedColorMap) {
      return;
    }
    // Cache the colormap using ref equality. This will
    // avoid updating the colormap unnecessarily.
    cachedColorMap = colorMap;

    const cfun = vtkColorTransferFunction.newInstance();
    const ofun = vtkPiecewiseFunction.newInstance();

    Object.keys(colorMap).forEach((label) => {
      const l = Number(label);
      cfun.addRGBPoint(l, ...colorMap[label].slice(0, 3).map((c) => c / 255));
      ofun.addPoint(l, colorMap[label][3] / 255);
    });

    model.property.setRGBTransferFunction(cfun);
    model.property.setScalarOpacity(ofun);
  }

  function setInputData(labelmap) {
    if (labelMapSub) {
      labelMapSub.unsubscribe();
      labelMapSub = null;
    }

    if (labelmap) {
      labelMapSub = labelmap.onModified(() =>
        updateTransferFunctions(labelmap)
      );
      updateTransferFunctions(labelmap);
    }
  }

  // override because we manage our own color/opacity functions
  publicAPI.setColorBy = () => {};

  publicAPI.delete = macro.chain(publicAPI.delete, () => {
    if (labelMapSub) {
      labelMapSub.unsubscribe();
      labelMapSub = null;
    }
  });

  // Keep things updated
  model.sourceDependencies.push({ setInputData });
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  vtkIJKSliceRepresentationProxy.extend(publicAPI, model);

  // Object specific methods
  vtkLabelMapSliceRepProxy(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkLabelMapSliceRepProxy'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
