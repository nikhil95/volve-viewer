import { vtkSubscription } from '@kitware/vtk.js/interfaces';
import vtkAbstractWidget from '@kitware/vtk.js/Widgets/Core/AbstractWidget';
import vtkAbstractWidgetFactory from '@kitware/vtk.js/Widgets/Core/AbstractWidgetFactory';
import vtkPlaneManipulator from '@kitware/vtk.js/Widgets/Manipulators/PlaneManipulator';
import { RulerWidgetState } from './state';

export interface vtkRulerViewWidget extends vtkAbstractWidget {
  setManipulator(manipulator: vtkPlaneManipulator): boolean;
  getManipulator(): vtkPlaneManipulator;
  onRightClickEvent(cb: (eventData: any) => void): vtkSubscription;
}

export interface vtkRulerWidget extends vtkAbstractWidgetFactory {
  getLength(): number;
  getWidgetState(): RulerWidgetState;
}

export function newInstance(): vtkRulerWidget;

export function shouldIgnoreEvent(ev: any): boolean;

export declare const vtkRulerWidget: {
  newInstance: typeof newInstance;
};
export default vtkRulerWidget;
