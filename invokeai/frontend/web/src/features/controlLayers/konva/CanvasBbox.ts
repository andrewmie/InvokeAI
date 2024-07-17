import { roundToMultiple, roundToMultipleMin } from 'common/util/roundDownToMultiple';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { Rect } from 'features/controlLayers/store/types';
import Konva from 'konva';
import { atom } from 'nanostores';
import { assert } from 'tsafe';

export class CanvasBbox {
  static BASE_NAME = 'bbox';
  static GROUP_NAME = `${CanvasBbox.BASE_NAME}_group`;
  static RECT_NAME = `${CanvasBbox.BASE_NAME}_rect`;
  static TRANSFORMER_NAME = `${CanvasBbox.BASE_NAME}_transformer`;

  group: Konva.Group;
  rect: Konva.Rect;
  transformer: Konva.Transformer;
  manager: CanvasManager;

  ALL_ANCHORS: string[] = [
    'top-left',
    'top-center',
    'top-right',
    'middle-right',
    'middle-left',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];
  CORNER_ANCHORS: string[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  NO_ANCHORS: string[] = [];

  constructor(manager: CanvasManager) {
    this.manager = manager;
    // Create a stash to hold onto the last aspect ratio of the bbox - this allows for locking the aspect ratio when
    // transforming the bbox.
    const bbox = this.manager.stateApi.getBbox();
    const $aspectRatioBuffer = atom(bbox.rect.width / bbox.rect.height);

    // Use a transformer for the generation bbox. Transformers need some shape to transform, we will use a fully
    // transparent rect for this purpose.
    this.group = new Konva.Group({ name: CanvasBbox.GROUP_NAME, listening: false });
    this.rect = new Konva.Rect({
      name: CanvasBbox.RECT_NAME,
      listening: false,
      strokeEnabled: false,
      draggable: true,
      ...this.manager.stateApi.getBbox(),
    });
    this.rect.on('dragmove', () => {
      const gridSize = this.manager.stateApi.getCtrlKey() || this.manager.stateApi.getMetaKey() ? 8 : 64;
      const bbox = this.manager.stateApi.getBbox();
      const bboxRect: Rect = {
        ...bbox.rect,
        x: roundToMultiple(this.rect.x(), gridSize),
        y: roundToMultiple(this.rect.y(), gridSize),
      };
      this.rect.setAttrs(bboxRect);
      if (bbox.rect.x !== bboxRect.x || bbox.rect.y !== bboxRect.y) {
        this.manager.stateApi.onBboxTransformed(bboxRect);
      }
    });

    this.transformer = new Konva.Transformer({
      name: CanvasBbox.TRANSFORMER_NAME,
      borderDash: [5, 5],
      borderStroke: 'rgba(212,216,234,1)',
      borderEnabled: true,
      rotateEnabled: false,
      keepRatio: false,
      ignoreStroke: true,
      listening: false,
      flipEnabled: false,
      anchorFill: 'rgba(212,216,234,1)',
      anchorStroke: 'rgb(42,42,42)',
      anchorSize: 12,
      anchorCornerRadius: 3,
      shiftBehavior: 'none', // we will implement our own shift behavior
      centeredScaling: false,
      anchorStyleFunc: (anchor) => {
        // Make the x/y resize anchors little bars
        if (anchor.hasName('top-center') || anchor.hasName('bottom-center')) {
          anchor.height(8);
          anchor.offsetY(4);
          anchor.width(30);
          anchor.offsetX(15);
        }
        if (anchor.hasName('middle-left') || anchor.hasName('middle-right')) {
          anchor.height(30);
          anchor.offsetY(15);
          anchor.width(8);
          anchor.offsetX(4);
        }
      },
      anchorDragBoundFunc: (_oldAbsPos, newAbsPos) => {
        // This function works with absolute position - that is, a position in "physical" pixels on the screen, as opposed
        // to konva's internal coordinate system.
        const stage = this.transformer.getStage();
        assert(stage, 'Stage must exist');

        // We need to snap the anchors to the grid. If the user is holding ctrl/meta, we use the finer 8px grid.
        const gridSize = this.manager.stateApi.getCtrlKey() || this.manager.stateApi.getMetaKey() ? 8 : 64;
        // Because we are working in absolute coordinates, we need to scale the grid size by the stage scale.
        const scaledGridSize = gridSize * stage.scaleX();
        // To snap the anchor to the grid, we need to calculate an offset from the stage's absolute position.
        const stageAbsPos = stage.getAbsolutePosition();
        // The offset is the remainder of the stage's absolute position divided by the scaled grid size.
        const offsetX = stageAbsPos.x % scaledGridSize;
        const offsetY = stageAbsPos.y % scaledGridSize;
        // Finally, calculate the position by rounding to the grid and adding the offset.
        return {
          x: roundToMultiple(newAbsPos.x, scaledGridSize) + offsetX,
          y: roundToMultiple(newAbsPos.y, scaledGridSize) + offsetY,
        };
      },
    });

    this.transformer.on('transform', () => {
      // In the transform callback, we calculate the bbox's new dims and pos and update the konva object.
      // Some special handling is needed depending on the anchor being dragged.
      const anchor = this.transformer.getActiveAnchor();
      if (!anchor) {
        // Pretty sure we should always have an anchor here?
        return;
      }

      const alt = this.manager.stateApi.getAltKey();
      const ctrl = this.manager.stateApi.getCtrlKey();
      const meta = this.manager.stateApi.getMetaKey();
      const shift = this.manager.stateApi.getShiftKey();

      // Grid size depends on the modifier keys
      let gridSize = ctrl || meta ? 8 : 64;

      // Alt key indicates we are using centered scaling. We need to double the gride size used when calculating the
      // new dimensions so that each size scales in the correct increments and doesn't mis-place the bbox. For example, if
      // we snapped the width and height to 8px increments, the bbox would be mis-placed by 4px in the x and y axes.
      // Doubling the grid size ensures the bbox's coords remain aligned to the 8px/64px grid.
      if (this.manager.stateApi.getAltKey()) {
        gridSize = gridSize * 2;
      }

      // The coords should be correct per the anchorDragBoundFunc.
      let x = this.rect.x();
      let y = this.rect.y();

      // Konva transforms by scaling the dims, not directly changing width and height. At this point, the width and height
      // *have not changed*, only the scale has changed. To get the final height, we need to scale the dims and then snap
      // them to the grid.
      let width = roundToMultipleMin(this.rect.width() * this.rect.scaleX(), gridSize);
      let height = roundToMultipleMin(this.rect.height() * this.rect.scaleY(), gridSize);

      // If shift is held and we are resizing from a corner, retain aspect ratio - needs special handling. We skip this
      // if alt/opt is held - this requires math too big for my brain.
      if (shift && this.CORNER_ANCHORS.includes(anchor) && !alt) {
        // Fit the bbox to the last aspect ratio
        let fittedWidth = Math.sqrt(width * height * $aspectRatioBuffer.get());
        let fittedHeight = fittedWidth / $aspectRatioBuffer.get();
        fittedWidth = roundToMultipleMin(fittedWidth, gridSize);
        fittedHeight = roundToMultipleMin(fittedHeight, gridSize);

        // We need to adjust the x and y coords to have the resize occur from the right origin.
        if (anchor === 'top-left') {
          // The transform origin is the bottom-right anchor. Both x and y need to be updated.
          x = x - (fittedWidth - width);
          y = y - (fittedHeight - height);
        }
        if (anchor === 'top-right') {
          // The transform origin is the bottom-left anchor. Only y needs to be updated.
          y = y - (fittedHeight - height);
        }
        if (anchor === 'bottom-left') {
          // The transform origin is the top-right anchor. Only x needs to be updated.
          x = x - (fittedWidth - width);
        }
        // Update the width and height to the fitted dims.
        width = fittedWidth;
        height = fittedHeight;
      }

      const bboxRect = {
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
      };

      // Update the bboxRect's attrs directly with the new transform, and reset its scale to 1.
      // TODO(psyche): In `renderBboxPreview()` we also call setAttrs, need to do it twice to ensure it renders correctly.
      // Gotta be a way to avoid setting it twice...
      this.rect.setAttrs({ ...bboxRect, scaleX: 1, scaleY: 1 });

      // Update the bbox in internal state.
      this.manager.stateApi.onBboxTransformed(bboxRect);

      // Update the aspect ratio buffer whenever the shift key is not held - this allows for a nice UX where you can start
      // a transform, get the right aspect ratio, then hold shift to lock it in.
      if (!shift) {
        $aspectRatioBuffer.set(bboxRect.width / bboxRect.height);
      }
    });

    this.transformer.on('transformend', () => {
      // Always update the aspect ratio buffer when the transform ends, so if the next transform starts with shift held,
      // we have the correct aspect ratio to start from.
      $aspectRatioBuffer.set(this.rect.width() / this.rect.height());
    });

    // The transformer will always be transforming the dummy rect
    this.transformer.nodes([this.rect]);
    this.group.add(this.rect);
    this.group.add(this.transformer);
  }

  render() {
    const session = this.manager.stateApi.getSession();
    const bbox = this.manager.stateApi.getBbox();
    const toolState = this.manager.stateApi.getToolState();

    if (!session.isActive) {
      this.group.listening(false);
      this.group.visible(false);
      return;
    }

    this.group.visible(true);
    this.group.listening(toolState.selected === 'bbox');
    this.rect.setAttrs({
      x: bbox.rect.x,
      y: bbox.rect.y,
      width: bbox.rect.width,
      height: bbox.rect.height,
      scaleX: 1,
      scaleY: 1,
      listening: toolState.selected === 'bbox',
    });
    this.transformer.setAttrs({
      listening: toolState.selected === 'bbox',
      enabledAnchors: toolState.selected === 'bbox' ? this.ALL_ANCHORS : this.NO_ANCHORS,
    });
  }
}