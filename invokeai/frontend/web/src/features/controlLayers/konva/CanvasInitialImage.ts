import { CanvasImage } from 'features/controlLayers/konva/CanvasImage';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { InitialImageEntity } from 'features/controlLayers/store/types';
import Konva from 'konva';

export class CanvasInitialImage {
  static NAME_PREFIX = 'initial-image';
  static LAYER_NAME = `${CanvasInitialImage.NAME_PREFIX}_layer`;
  static GROUP_NAME = `${CanvasInitialImage.NAME_PREFIX}_group`;
  static OBJECT_GROUP_NAME = `${CanvasInitialImage.NAME_PREFIX}_object-group`;

  id = 'initial_image';

  private initialImageState: InitialImageEntity;

  manager: CanvasManager;

  konva: {
    layer: Konva.Layer;
    group: Konva.Group;
    objectGroup: Konva.Group;
  };

  image: CanvasImage | null;

  constructor(initialImageState: InitialImageEntity, manager: CanvasManager) {
    this.manager = manager;
    this.konva = {
      layer: new Konva.Layer({ name: CanvasInitialImage.LAYER_NAME, imageSmoothingEnabled: true, listening: false }),
      group: new Konva.Group({ name: CanvasInitialImage.GROUP_NAME, listening: false }),
      objectGroup: new Konva.Group({ name: CanvasInitialImage.OBJECT_GROUP_NAME, listening: false }),
    };
    this.konva.group.add(this.konva.objectGroup);
    this.konva.layer.add(this.konva.group);

    this.image = null;
    this.initialImageState = initialImageState;
  }

  async render(initialImageState: InitialImageEntity) {
    this.initialImageState = initialImageState;

    if (!this.initialImageState.imageObject) {
      this.konva.layer.visible(false);
      return;
    }

    if (!this.image) {
      this.image = new CanvasImage(this.initialImageState.imageObject);
      this.konva.objectGroup.add(this.image.konva.group);
      await this.image.update(this.initialImageState.imageObject, true);
    } else if (!this.image.isLoading && !this.image.isError) {
      await this.image.update(this.initialImageState.imageObject);
    }

    if (this.initialImageState && this.initialImageState.isEnabled && !this.image?.isLoading && !this.image?.isError) {
      this.konva.layer.visible(true);
    } else {
      this.konva.layer.visible(false);
    }
  }

  destroy(): void {
    this.konva.layer.destroy();
  }
}
