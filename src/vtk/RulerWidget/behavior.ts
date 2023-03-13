import { vtkSubscription } from '@kitware/vtk.js/interfaces';
import macro from '@kitware/vtk.js/macro';
import { Vector3 } from '@kitware/vtk.js/types';
import { InteractionState, RulerPointWidgetState } from './state';

export function shouldIgnoreEvent(e: any) {
  return e.altKey || e.controlKey || e.shiftKey;
}

export default function widgetBehavior(publicAPI: any, model: any) {
  model.classHierarchy.push('vtkRulerWidgetProp');

  const superClass = { ...publicAPI };

  const subscriptions: vtkSubscription[] = [];
  let dragging: RulerPointWidgetState | null = null;

  // support setting per-view widget manipulators
  macro.setGet(publicAPI, model, ['manipulator']);
  // support forwarding events
  macro.event(publicAPI, model, 'RightClickEvent');

  publicAPI.setFirstPoint = (coord: Vector3) => {
    const point = model.widgetState.getFirstPoint();
    point.setOrigin(coord);
  };

  publicAPI.setSecondPoint = (coord: Vector3) => {
    const point = model.widgetState.getSecondPoint();
    point.setOrigin(coord);
  };

  /**
   * Places or drags a point.
   */
  publicAPI.handleLeftButtonPress = (eventData: any) => {
    if (!model.manipulator || shouldIgnoreEvent(eventData)) {
      return macro.VOID;
    }

    const intState = model.widgetState.getInteractionState();

    // in order to place points, we should be...
    if (
      // focused
      model.hasFocus &&
      // not be settled
      intState !== InteractionState.Settled
    ) {
      const worldCoords = model.manipulator.handleEvent(
        eventData,
        model._apiSpecificRenderWindow
      );
      if (worldCoords.length) {
        if (intState === InteractionState.PlacingFirst) {
          publicAPI.setFirstPoint(worldCoords);
          model.widgetState.setInteractionState(InteractionState.PlacingSecond);
        } else if (intState === InteractionState.PlacingSecond) {
          publicAPI.setSecondPoint(worldCoords);
          model.widgetState.setInteractionState(InteractionState.Settled);
        }
        publicAPI.invokeInteractionEvent();
        return macro.EVENT_ABORT;
      }
    }

    // widget is considered settled, so see if we
    // are trying to drag a point.
    if (model.activeState?.getActive() && model.pickable) {
      dragging = model.activeState;
      model._apiSpecificRenderWindow.setCursor('grabbing');
      model._interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
      return macro.EVENT_ABORT;
    }

    return macro.VOID;
  };

  /**
   * Moves a point around.
   */
  publicAPI.handleMouseMove = (eventData: any) => {
    const intState = model.widgetState.getInteractionState();

    if (model.hasFocus && intState === InteractionState.Settled) {
      publicAPI.loseFocus();
      return macro.VOID;
    }

    if (
      dragging || // moving an existing point
      intState !== InteractionState.Settled // placing a point
    ) {
      const worldCoords = model.manipulator.handleEvent(
        eventData,
        model._apiSpecificRenderWindow
      );

      if (worldCoords.length) {
        if (dragging) {
          dragging.setOrigin(worldCoords);
        } else if (intState === InteractionState.PlacingFirst) {
          model.widgetState.getFirstPoint().setVisible(true);
          publicAPI.setFirstPoint(worldCoords);
        } else if (intState === InteractionState.PlacingSecond) {
          model.widgetState.getSecondPoint().setVisible(true);
          publicAPI.setSecondPoint(worldCoords);
        }
        publicAPI.invokeInteractionEvent();
      }

      return macro.EVENT_ABORT;
    }

    return macro.VOID;
  };

  /**
   * Finishes dragging
   */
  publicAPI.handleLeftButtonRelease = (eventData: any) => {
    if (dragging) {
      const worldCoords = model.manipulator.handleEvent(
        eventData,
        model._apiSpecificRenderWindow
      );
      if (worldCoords.length) {
        dragging.setOrigin(worldCoords);
      }

      dragging = null;
      model._apiSpecificRenderWindow.setCursor('pointer');
      model.widgetState.deactivate();
      model._interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
      // model._widgetManager.enablePicking();
      // model._interactor.render();
    }
  };

  publicAPI.handleRightButtonPress = (eventData: any) => {
    if (
      shouldIgnoreEvent(eventData) ||
      model.widgetState.getInteractionState() !== InteractionState.Settled || // ignore when still placing
      !model.activeState?.getActive() || // ignore when no selected state
      model.hasFocus || // ignore when focused
      dragging // ignore when dragging
    ) {
      return macro.VOID;
    }
    publicAPI.invokeRightClickEvent(eventData);
    return macro.EVENT_ABORT;
  };

  publicAPI.grabFocus = () => {
    if (
      !model.hasFocus &&
      // only allow focus if placing points
      model.widgetState.getInteractionState() !== InteractionState.Settled
    ) {
      model.hasFocus = true;
      // render the (invisible) point handles
      model._interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
    }
  };

  publicAPI.loseFocus = () => {
    if (model.hasFocus) {
      model._interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
    }
    model.hasFocus = false;
    // model._widgetManager.enablePicking();
    // model._interactor.render();
  };

  publicAPI.delete = () => {
    superClass.delete();
    while (subscriptions.length) {
      subscriptions.pop()!.unsubscribe();
    }
  };
}
