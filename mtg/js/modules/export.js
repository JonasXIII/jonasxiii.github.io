// export.js - Generate and download changes.json

import * as state from './state.js';

export function generateChangesJson() {
    const changeLog = state.getChangeLog();

    return {
        timestamp: new Date().toISOString(),
        version: 1,
        collection_changes: changeLog.collection_changes,
        deck_changes: changeLog.deck_changes,
        binder_changes: changeLog.binder_changes
    };
}

export function downloadChangesJson() {
    const changes = generateChangesJson();
    const json = JSON.stringify(changes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'changes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    state.resetChangeLog();
    return changes;
}
