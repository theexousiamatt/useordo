import { type KeyboardCoordinateGetter, type PointerSensorOptions } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { TASK_COLUMNS } from "./projectConstants";

export const BOARD_POINTER_OPTIONS: PointerSensorOptions = { activationConstraint: { distance: 8 } };

/** Sortable's default getter ignores empty non-sortable column droppables. */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const sorted = sortableKeyboardCoordinates(event, args);
  if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return sorted;
  const direction = event.code === "ArrowRight" ? 1 : -1;
  const candidates = args.context.droppableContainers.getEnabled()
    .filter(container => TASK_COLUMNS.some(column => column.id === container.id))
    .map(container => ({rect:args.context.droppableRects.get(container.id),empty:container.data.current?.empty === true}))
    .filter(item => item.rect && direction * (item.rect.left - args.currentCoordinates.x) > 20)
    .sort((a, b) => Math.abs(a.rect!.left - args.currentCoordinates.x) - Math.abs(b.rect!.left - args.currentCoordinates.x));
  const nearest = candidates[0];
  if (!nearest?.empty || !nearest.rect) return sorted;
  const destination=nearest.rect;
  event.preventDefault();
  return { x: destination.left + 16, y: destination.top + 56 };
};
