import { CanvasImage } from 'features/controlLayers/konva/CanvasImage';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasProgressImage } from 'features/controlLayers/konva/CanvasProgressImage';
import Konva from 'konva';
import type { ImageDTO } from 'services/api/types';

export class CanvasStagingArea {
  group: Konva.Group;
  image: CanvasImage | null;
  progressImage: CanvasProgressImage | null;
  imageDTO: ImageDTO | null;
  manager: CanvasManager;

  constructor(manager: CanvasManager) {
    this.manager = manager;
    this.group = new Konva.Group({ listening: false });
    this.image = null;
    this.progressImage = null;
    this.imageDTO = null;
  }

  async render() {
    const stagingArea = this.manager.stateApi.getSession();
    const bbox = this.manager.stateApi.getBbox();
    const shouldShowStagedImage = this.manager.stateApi.getShouldShowStagedImage();
    const lastProgressEvent = this.manager.stateApi.getLastProgressEvent();

    this.imageDTO = stagingArea.stagedImages[stagingArea.selectedStagedImageIndex] ?? null;

    if (this.imageDTO) {
      if (this.image) {
        if (!this.image.isLoading && !this.image.isError && this.image.imageName !== this.imageDTO.image_name) {
          await this.image.updateImageSource(this.imageDTO.image_name);
        }
        this.image.konvaImageGroup.x(bbox.x);
        this.image.konvaImageGroup.y(bbox.y);
        this.image.konvaImageGroup.visible(shouldShowStagedImage);
        this.progressImage?.konvaImageGroup.visible(false);
      } else {
        const { image_name, width, height } = this.imageDTO;
        this.image = new CanvasImage(
          {
            id: 'staging-area-image',
            type: 'image',
            x: bbox.x,
            y: bbox.y,
            width,
            height,
            filters: [],
            image: {
              name: image_name,
              width,
              height,
            },
          },
          {
            onLoad: (konvaImage) => {
              if (this.imageDTO) {
                konvaImage.width(this.imageDTO.width);
                konvaImage.height(this.imageDTO.height);
              }
              this.manager.stateApi.resetLastProgressEvent();
            },
          }
        );
        this.group.add(this.image.konvaImageGroup);
        await this.image.updateImageSource(this.imageDTO.image_name);
        this.image.konvaImageGroup.visible(shouldShowStagedImage);
        this.progressImage?.konvaImageGroup.visible(false);
      }
    }

    if (stagingArea.isStaging && lastProgressEvent) {
      const { invocation, step, progress_image } = lastProgressEvent;
      const { dataURL } = progress_image;
      const { x, y, width, height } = bbox;
      const progressImageId = `${invocation.id}_${step}`;
      if (this.progressImage) {
        if (
          !this.progressImage.isLoading &&
          !this.progressImage.isError &&
          this.progressImage.progressImageId !== progressImageId
        ) {
          await this.progressImage.updateImageSource(progressImageId, dataURL, x, y, width, height);
          this.image?.konvaImageGroup.visible(false);
          this.progressImage.konvaImageGroup.visible(true);
        }
      } else {
        this.progressImage = new CanvasProgressImage({ id: 'progress-image' });
        this.group.add(this.progressImage.konvaImageGroup);
        await this.progressImage.updateImageSource(progressImageId, dataURL, x, y, width, height);
        this.image?.konvaImageGroup.visible(false);
        this.progressImage.konvaImageGroup.visible(true);
      }
    }

    if (!this.imageDTO && !lastProgressEvent) {
      if (this.image) {
        this.image.konvaImageGroup.visible(false);
      }
      if (this.progressImage) {
        this.progressImage.konvaImageGroup.visible(false);
      }
      this.manager.stateApi.resetLastProgressEvent();
    }
  }
}
