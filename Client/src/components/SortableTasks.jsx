import { createElement } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// Drag-to-reorder for task lists (table rows, sheet rows, cards). Rows move
// only by their grip handle, so clicking, typing and selecting in a row keep
// working. Mouse, touch and keyboard (focus the grip, Space, arrows, Space)
// are all supported.

const verticalOnly = ({ transform }) => ({ ...transform, x: 0 });

// `ids`: the order on screen. `onMove(activeId, overId)` is called on drop.
export function SortableTaskList({ ids, onMove, children }) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            onDragEnd={({ active, over }) => over && active.id !== over.id && onMove(active.id, over.id)}
        >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
        </DndContext>
    );
}

// Renders `as` (e.g. "tr" or "div") as a sortable item. `children` is a
// function receiving the drag handle element and whether it is being dragged.
export function SortableItem({ id, as = "div", disabled = false, className = "", draggingClassName = "", children, ...rest }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

    const handle = disabled ? null : (
        <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            className="touch-none p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-blue-500"
        >
            <GripVertical className="size-4" />
        </button>
    );

    return createElement(
        as,
        {
            ...rest,
            ref: setNodeRef,
            style: {
                transform: CSS.Translate.toString(transform),
                transition,
                position: "relative",
                zIndex: isDragging ? 20 : undefined,
            },
            className: `${className} ${isDragging ? draggingClassName : ""}`,
        },
        children(handle, isDragging)
    );
}
