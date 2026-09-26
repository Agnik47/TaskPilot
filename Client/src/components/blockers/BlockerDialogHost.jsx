import { useEffect, useState } from "react";
import { onBlockerDialogRequest } from "../../lib/blockers";
import AddBlockerDialog from "./AddBlockerDialog";

// Mounted once in the layout: renders the "What's blocking this?" dialog
// whenever any status picker or button asks for it.
export default function BlockerDialogHost() {
    const [request, setRequest] = useState(null);

    useEffect(() => onBlockerDialogRequest((task, options) => setRequest({ task, ...options })), []);

    if (!request) return null;
    return <AddBlockerDialog task={request.task} fromStatusPicker={request.fromStatusPicker} onClose={() => setRequest(null)} />;
}
