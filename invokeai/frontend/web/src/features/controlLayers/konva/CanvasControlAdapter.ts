import { CanvasImage } from 'features/controlLayers/konva/CanvasImage';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { type ControlAdapterEntity, isDrawingTool } from 'features/controlLayers/store/types';
import Konva from 'konva';

export class CanvasControlAdapter {
  static NAME_PREFIX = 'control-adapter';
  static LAYER_NAME = `${CanvasControlAdapter.NAME_PREFIX}_layer`;
  static TRANSFORMER_NAME = `${CanvasControlAdapter.NAME_PREFIX}_transformer`;
  static GROUP_NAME = `${CanvasControlAdapter.NAME_PREFIX}_group`;
  static OBJECT_GROUP_NAME = `${CanvasControlAdapter.NAME_PREFIX}_object-group`;

  private controlAdapterState: ControlAdapterEntity;

  id: string;
  manager: CanvasManager;
  layer: Konva.Layer;
  group: Konva.Group;
  objectsGroup: Konva.Group;
  image: CanvasImage | null;
  transformer: Konva.Transformer;

  constructor(controlAdapterState: ControlAdapterEntity, manager: CanvasManager) {
    const { id } = controlAdapterState;
    this.id = id;
    this.manager = manager;
    this.layer = new Konva.Layer({
      name: CanvasControlAdapter.LAYER_NAME,
      imageSmoothingEnabled: false,
      listening: false,
    });
    this.group = new Konva.Group({
      name: CanvasControlAdapter.GROUP_NAME,
      listening: false,
    });
    this.objectsGroup = new Konva.Group({ name: CanvasControlAdapter.GROUP_NAME, listening: false });
    this.group.add(this.objectsGroup);
    this.layer.add(this.group);

    this.transformer = new Konva.Transformer({
      name: CanvasControlAdapter.TRANSFORMER_NAME,
      shouldOverdrawWholeArea: true,
      draggable: true,
      dragDistance: 0,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: false,
      flipEnabled: false,
    });
    this.transformer.on('transformend', () => {
      this.manager.stateApi.onScaleChanged(
        { id: this.id, scale: this.group.scaleX(), position: { x: this.group.x(), y: this.group.y() } },
        'control_adapter'
      );
    });
    this.transformer.on('dragend', () => {
      this.manager.stateApi.onPosChanged(
        { id: this.id, position: { x: this.group.x(), y: this.group.y() } },
        'control_adapter'
      );
    });
    this.layer.add(this.transformer);

    this.image = null;
    this.controlAdapterState = controlAdapterState;
  }

  async render(controlAdapterState: ControlAdapterEntity) {
    this.controlAdapterState = controlAdapterState;

    // Update the layer's position and listening state
    this.group.setAttrs({
      x: controlAdapterState.position.x,
      y: controlAdapterState.position.y,
      scaleX: 1,
      scaleY: 1,
    });

    const imageObject = controlAdapterState.processedImageObject ?? controlAdapterState.imageObject;

    let didDraw = false;

    if (!imageObject) {
      if (this.image) {
        this.image.konvaImageGroup.visible(false);
        didDraw = true;
      }
    } else if (!this.image) {
      this.image = new CanvasImage(imageObject);
      this.updateGroup(true);
      this.objectsGroup.add(this.image.konvaImageGroup);
      await this.image.updateImageSource(imageObject.image.name);
    } else if (!this.image.isLoading && !this.image.isError) {
      if (await this.image.update(imageObject)) {
        didDraw = true;
      }
    }

    this.updateGroup(didDraw);
  }

  updateGroup(didDraw: boolean) {
    this.layer.visible(this.controlAdapterState.isEnabled);

    this.group.opacity(this.controlAdapterState.opacity);
    const isSelected = this.manager.stateApi.getIsSelected(this.id);
    const selectedTool = this.manager.stateApi.getToolState().selected;

    if (!this.image?.konvaImage) {
      // If the layer is totally empty, reset the cache and bail out.
      this.layer.listening(false);
      this.transformer.nodes([]);
      if (this.group.isCached()) {
        this.group.clearCache();
      }
      return;
    }

    if (isSelected && selectedTool === 'move') {
      // When the layer is selected and being moved, we should always cache it.
      // We should update the cache if we drew to the layer.
      if (!this.group.isCached() || didDraw) {
        this.group.cache();
      }
      // Activate the transformer
      this.layer.listening(true);
      this.transformer.nodes([this.group]);
      this.transformer.forceUpdate();
      return;
    }

    if (isSelected && selectedTool !== 'move') {
      // If the layer is selected but not using the move tool, we don't want the layer to be listening.
      this.layer.listening(false);
      // The transformer also does not need to be active.
      this.transformer.nodes([]);
      if (isDrawingTool(selectedTool)) {
        // We are using a drawing tool (brush, eraser, rect). These tools change the layer's rendered appearance, so we
        // should never be cached.
        if (this.group.isCached()) {
          this.group.clearCache();
        }
      } else {
        // We are using a non-drawing tool (move, view, bbox), so we should cache the layer.
        // We should update the cache if we drew to the layer.
        if (!this.group.isCached() || didDraw) {
          this.group.cache();
        }
      }
      return;
    }

    if (!isSelected) {
      // Unselected layers should not be listening
      this.layer.listening(false);
      // The transformer also does not need to be active.
      this.transformer.nodes([]);
      // Update the layer's cache if it's not already cached or we drew to it.
      if (!this.group.isCached() || didDraw) {
        this.group.cache();
      }

      return;
    }
  }

  destroy(): void {
    this.layer.destroy();
  }
}